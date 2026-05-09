import { loadClassicScript } from "./classic-script-loader.js";
import { resolveBrowserLoadUrl, resolveUrl } from "../utils/resolve-url.js";
import { createRoseltErrorMarkup, reportRoseltResourceError } from "./dev-error-overlay.js";

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createCodeFrame(source, lineNumber) {
  const lines = String(source || "").split("\n");

  if (!lineNumber || lineNumber < 1 || lineNumber > lines.length) {
    return null;
  }

  const startLine = Math.max(1, lineNumber - 2);
  const endLine = Math.min(lines.length, lineNumber + 2);

  return {
    startLine,
    endLine,
    highlightLine: lineNumber,
    lines: lines.slice(startLine - 1, endLine).map((text, index) => ({
      lineNumber: startLine + index,
      text,
      highlight: startLine + index === lineNumber,
    })),
  };
}

function findIncludeMatch(source, includeNode, src) {
  const exactMarkup = includeNode?.outerHTML;

  if (exactMarkup) {
    const exactIndex = source.indexOf(exactMarkup);

    if (exactIndex >= 0) {
      return {
        index: exactIndex,
        text: exactMarkup,
      };
    }
  }

  const sectionPattern = new RegExp(
    `<roselt\\b[^>]*\\bsection\\s*=\\s*(["'])${escapeRegExp(src)}\\1[^>]*>(?:\\s*<\\/roselt>)?`,
    "i",
  );
  const match = sectionPattern.exec(source);

  if (!match) {
    return null;
  }

  return {
    index: match.index,
    text: match[0],
  };
}

function createSourceLocation(url, source, match) {
  if (!match) {
    return null;
  }

  const prefix = source.slice(0, match.index);
  const line = prefix.split("\n").length;
  const lastNewline = prefix.lastIndexOf("\n");
  const column = match.index - lastNewline;

  return {
    url,
    line,
    column,
    codeFrame: createCodeFrame(source, line),
  };
}

function createMissingSectionError(url, reference, cause) {
  const error = new Error(`Failed to load section HTML: ${url}`);
  error.code = "ROSELT_SECTION_NOT_FOUND";
  error.sectionUrl = url;
  error.sectionReference = reference;
  error.cause = cause;
  return error;
}

function isMissingSectionFetchError(error) {
  if (error?.code === "ROSELT_SECTION_NOT_FOUND") {
    return true;
  }

  const message = String(error);

  return (
    error instanceof TypeError ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError")
  );
}

export class SectionLoader {
  constructor(options = {}) {
    const { sectionsDirectory = "sections" } = options;

    this.sectionsDirectory = sectionsDirectory;
    this.sectionCache = new Map();
    this.sourceCache = new Map();
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

      try {
        const sectionHtml = await this.loadSection(sectionUrl, src);
        const resolvedHtml = await this.resolveIncludes(sectionHtml, sectionUrl);
        const replacement = document.createRange().createContextualFragment(resolvedHtml);
        this.annotateSectionFragment(replacement, sectionUrl);
        includeNode.replaceWith(replacement);
      } catch (error) {
        if (error?.code !== "ROSELT_SECTION_NOT_FOUND") {
          throw error;
        }

        const includeLocation = await this.resolveIncludeLocation(baseUrl, includeNode, src);

        const details = reportRoseltResourceError({
          kind: "section",
          resourceType: "section file",
          title: "Missing Section File",
          message: "Roselt.js could not load a referenced section, so a placeholder was rendered in its place.",
          reference: src,
          requestedUrl: sectionUrl,
          source: includeLocation?.url || baseUrl,
          topFrame: includeLocation
            ? {
                functionName: "roselt[section]",
                url: includeLocation.url,
                line: includeLocation.line,
                column: includeLocation.column,
              }
            : null,
          codeFrame: includeLocation?.codeFrame || null,
          stack: includeLocation ? "" : undefined,
          cause: error,
        });
        const replacement = document.createRange().createContextualFragment(
          createRoseltErrorMarkup(details),
        );

        includeNode.replaceWith(replacement);
      }
    }
  }

  async loadSource(url) {
    if (!this.sourceCache.has(url)) {
      this.sourceCache.set(
        url,
        fetch(resolveBrowserLoadUrl(url))
          .then(async (response) => (response.ok ? response.text() : null))
          .catch(() => null),
      );
    }

    return this.sourceCache.get(url);
  }

  async resolveIncludeLocation(baseUrl, includeNode, src) {
    const source = await this.loadSource(baseUrl);

    if (!source) {
      return null;
    }

    return createSourceLocation(baseUrl, source, findIncludeMatch(source, includeNode, src));
  }

  annotateSectionFragment(fragment, sectionUrl) {
    for (const node of Array.from(fragment.childNodes)) {
      if (!(node instanceof Element)) {
        continue;
      }

      node.setAttribute("data-roselt-section-source", sectionUrl);
    }
  }

  loadSection(url, reference = "") {
    if (!this.sectionCache.has(url)) {
      this.sectionCache.set(
        url,
        fetch(resolveBrowserLoadUrl(url))
          .then(async (response) => {
            if (!response.ok) {
              throw createMissingSectionError(url, reference);
            }

            return response.text();
          })
          .catch((error) => {
            if (isMissingSectionFetchError(error)) {
              throw createMissingSectionError(url, reference, error);
            }

            throw error;
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