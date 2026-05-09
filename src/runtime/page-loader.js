import { resolveBrowserLoadUrl, resolveUrl } from "../utils/resolve-url.js";
import { createEmptyPageScript, loadPageScript, normalizePageScript } from "./page-script.js";
import { reportRoseltResourceError } from "./dev-error-overlay.js";

function createMissingPageError(url, cause) {
  const error = new Error(`Failed to load page HTML: ${url}`);
  error.code = "ROSELT_PAGE_NOT_FOUND";
  error.pageUrl = url;
  error.cause = cause;
  return error;
}

function isMissingPageFetchError(error) {
  if (error?.code === "ROSELT_PAGE_NOT_FOUND") {
    return true;
  }

  const message = String(error);

  return (
    error instanceof TypeError ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError")
  );
}

export class PageLoader {
  constructor() {
    this.htmlCache = new Map();
    this.moduleCache = new Map();
    this.stylesheetCache = new Map();
  }

  async load(route) {
    const htmlUrl = route.html
      ? resolveUrl(route.html)
      : route.htmlUrl
        ? resolveUrl(route.htmlUrl)
        : document.baseURI;
    const moduleUrl = typeof route.module === "string"
      ? resolveUrl(route.module)
      : route.moduleUrl
        ? resolveUrl(route.moduleUrl)
        : document.baseURI;
    const html = await (route.htmlContent ?? this.loadHtml(htmlUrl));
    const module = await (
      route.moduleObject ??
      (typeof route.module === "function" && !route.module.prototype
        ? route.module()
        : this.loadModule(moduleUrl))
    );

    return {
      html,
      module,
      htmlUrl,
      moduleUrl,
    };
  }

  loadHtml(url) {
    if (!this.htmlCache.has(url)) {
      this.htmlCache.set(
        url,
        fetch(resolveBrowserLoadUrl(url))
          .then(async (response) => {
                if (!response.ok) {
                  throw createMissingPageError(url);
                }

                return response.text();
              })
          .catch((error) => {
            if (isMissingPageFetchError(error)) {
              throw createMissingPageError(url, error);
            }

            throw error;
          }),
      );
    }

    return this.htmlCache.get(url);
  }

  loadModule(url) {
    if (!this.moduleCache.has(url)) {
      this.moduleCache.set(
        url,
        loadPageScript(url)
          .then((definition) => normalizePageScript(definition))
          .catch((error) => {
            const message = String(error);

            if (
              message.includes("Failed to fetch dynamically imported module") ||
              message.includes("Cannot find module") ||
              message.includes("Importing a module script failed")
            ) {
              reportRoseltResourceError({
                kind: "page",
                resourceType: "page module",
                title: "Missing Page Module",
                message: "Roselt.js could not load a referenced page script, so only the HTML was rendered.",
                requestedUrl: url,
                cause: error,
              });

              return normalizePageScript(createEmptyPageScript());
            }

            throw error;
          }),
      );
    }

    return this.moduleCache.get(url);
  }

  loadStylesheet(url, { optional = false } = {}) {
    const cacheKey = `${optional ? "optional" : "required"}:${url}`;

    if (!this.stylesheetCache.has(cacheKey)) {
      this.stylesheetCache.set(
        cacheKey,
        fetch(resolveBrowserLoadUrl(url))
          .then(async (response) => {
                if (!response.ok) {
                  if (optional) {
                    return null;
                  }

                  throw new Error(`Failed to load stylesheet: ${url}`);
                }

                return {
                  href: url,
                  cssText: await response.text(),
                };
              })
          .catch((error) => {
            if (optional) {
              const message = String(error);

              if (
                error instanceof TypeError ||
                message.includes("Failed to fetch") ||
                message.includes("NetworkError")
              ) {
                return null;
              }
            }

            throw error;
          }),
      );
    }

    return this.stylesheetCache.get(cacheKey);
  }

  clear() {
    this.htmlCache.clear();
    this.moduleCache.clear();
    this.stylesheetCache.clear();
  }

  isMissingPageError(error) {
    return error?.code === "ROSELT_PAGE_NOT_FOUND";
  }
}