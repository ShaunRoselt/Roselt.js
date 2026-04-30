import { loadClassicScript } from "./classic-script-loader.js";
import { resolveBrowserLoadUrl, resolveUrl } from "../utils/resolve-url.js";

function createSiblingResourceUrl(sectionUrl, extension) {
  const url = new URL(sectionUrl);

  if (!url.pathname.endsWith(".html")) {
    return null;
  }

  url.pathname = url.pathname.replace(/\.html$/, extension);
  return url.href;
}

function isShorthandSectionReference(value) {
  return Boolean(value) && !value.includes("/") && !value.includes(".") && !value.includes(":");
}

export class SectionLoader {
  constructor(options = {}) {
    const { sectionsDirectory = "sections" } = options;

    this.sectionsDirectory = sectionsDirectory;
    this.sectionCache = new Map();
    this.stylesheetCache = new Map();
    this.appliedStylesheets = new Map();
  }

  async resolveRootIncludes(root, baseUrl = document.baseURI) {
    await this.processTemplate(root, baseUrl);
  }

  async resolveIncludes(html, baseUrl) {
    const template = document.createElement("template");
    template.innerHTML = html;

    await this.processTemplate(template.content, baseUrl);

    return template.innerHTML;
  }

  async processTemplate(root, baseUrl) {
    const includes = Array.from(root.querySelectorAll("roselt[section]"));

    for (const includeNode of includes) {
      const src = includeNode.getAttribute("section");

      if (!src) {
        includeNode.remove();
        continue;
      }

      const sectionUrl = isShorthandSectionReference(src)
        ? resolveUrl(`${this.sectionsDirectory}/${src}.html`, document.baseURI)
        : resolveUrl(src, baseUrl);
      const sectionHtml = await this.loadSection(sectionUrl);
      const resolvedHtml = await this.resolveIncludes(sectionHtml, sectionUrl);
      const replacement = document.createRange().createContextualFragment(resolvedHtml);
      this.annotateSectionFragment(replacement, sectionUrl);
      includeNode.replaceWith(replacement);
    }
  }

  annotateSectionFragment(fragment, sectionUrl) {
    for (const node of Array.from(fragment.childNodes)) {
      if (!(node instanceof Element)) {
        continue;
      }

      node.setAttribute("data-roselt-section-source", sectionUrl);
    }
  }

  loadSection(url) {
    if (!this.sectionCache.has(url)) {
      this.sectionCache.set(
        url,
        fetch(resolveBrowserLoadUrl(url)).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load section HTML: ${url}`);
          }

          return response.text();
        }),
      );
    }

    return this.sectionCache.get(url);
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

  async ensureSectionAssets(sectionUrl) {
    const stylesheetUrl = createSiblingResourceUrl(sectionUrl, ".css");
    const scriptUrl = createSiblingResourceUrl(sectionUrl, ".js");

    if (stylesheetUrl) {
      await this.ensureSectionStylesheet(stylesheetUrl);
    }

    if (scriptUrl) {
      await loadClassicScript(scriptUrl, { optional: true });
    }
  }

  async ensureSectionStylesheet(url) {
    if (this.appliedStylesheets.has(url)) {
      return this.appliedStylesheets.get(url);
    }

    const promise = (async () => {
      const stylesheet = await this.loadStylesheet(url, { optional: true });

      if (!stylesheet?.cssText) {
        return null;
      }

      const style = document.createElement("style");
      style.textContent = stylesheet.cssText;
      style.setAttribute("data-roselt-section-style", "true");
      style.setAttribute("data-roselt-source", stylesheet.href);
      document.head.append(style);
      return style;
    })();

    this.appliedStylesheets.set(url, promise);
    return promise;
  }

  async hydrateRoot(root) {
    const sectionUrls = new Set();

    if (root instanceof Element && root.hasAttribute("data-roselt-section-source")) {
      sectionUrls.add(root.getAttribute("data-roselt-section-source"));
    }

    if (root && typeof root.querySelectorAll === "function") {
      for (const element of root.querySelectorAll("[data-roselt-section-source]")) {
        sectionUrls.add(element.getAttribute("data-roselt-section-source"));
      }
    }

    await Promise.all(
      Array.from(sectionUrls)
        .filter(Boolean)
        .map((sectionUrl) => this.ensureSectionAssets(sectionUrl)),
    );
  }
}