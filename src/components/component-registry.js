import { loadClassicScript } from "../runtime/classic-script-loader.js";
import { reportRoseltResourceError } from "../runtime/dev-error-overlay.js";
import { resolveBrowserLoadUrl, resolveUrl } from "../utils/resolve-url.js";

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

function findComponentMatch(source, element, tagName) {
  const exactMarkup = element?.outerHTML;

  if (exactMarkup) {
    const exactIndex = source.indexOf(exactMarkup);

    if (exactIndex >= 0) {
      return {
        index: exactIndex,
        text: exactMarkup,
      };
    }
  }

  const tagPattern = new RegExp(
    `<${escapeRegExp(tagName)}\\b[^>]*>(?:[\\s\\S]*?<\\/${escapeRegExp(tagName)}>)?`,
    "i",
  );
  const match = tagPattern.exec(source);

  if (match) {
    return {
      index: match.index,
      text: match[0],
    };
  }

  const selfClosingPattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*\\/>`, "i");
  const selfClosingMatch = selfClosingPattern.exec(source);

  if (!selfClosingMatch) {
    return null;
  }

  return {
    index: selfClosingMatch.index,
    text: selfClosingMatch[0],
  };
}

function resolveElementSourceUrl(element) {
  const sectionHost = element?.closest?.("[data-roselt-section-source]");

  if (sectionHost?.getAttribute) {
    return sectionHost.getAttribute("data-roselt-section-source") || "";
  }

  const pageHost = element?.closest?.("[data-roselt-page-source]");

  if (pageHost?.getAttribute) {
    return pageHost.getAttribute("data-roselt-page-source") || "";
  }

  return document.baseURI;
}

function isCustomElementConstructor(value) {
  return typeof value === "function" && value.prototype instanceof HTMLElement;
}

export class ComponentRegistry {
  constructor() {
    this.definitions = new Map();
    this.inFlight = new Map();
    this.sourceCache = new Map();
  }

  register(tagName, definition) {
    if (!tagName.includes("-")) {
      throw new Error(`Custom element names must include a hyphen: ${tagName}`);
    }

    this.definitions.set(tagName, definition);

    if (isCustomElementConstructor(definition) && !customElements.get(tagName)) {
      customElements.define(tagName, definition);
    }
  }

  registerAll(definitions = {}) {
    for (const [tagName, definition] of Object.entries(definitions)) {
      this.register(tagName, definition);
    }
  }

  async ensureForRoot(root, fallbackResolver) {
    const tagElements = new Map();

    if (root instanceof Element && root.localName.includes("-")) {
      tagElements.set(root.localName, root);
    }

    for (const element of root.querySelectorAll("*")) {
      if (element.localName.includes("-") && !customElements.get(element.localName)) {
        if (!tagElements.has(element.localName)) {
          tagElements.set(element.localName, element);
        }
      }
    }

    await Promise.all(
      Array.from(tagElements, ([tagName, element]) =>
        this.load(tagName, fallbackResolver, { element }),
      ),
    );
  }

  async load(tagName, fallbackResolver, context = {}) {
    if (customElements.get(tagName)) {
      return customElements.get(tagName);
    }

    if (!this.inFlight.has(tagName)) {
      this.inFlight.set(tagName, this.resolveDefinition(tagName, fallbackResolver, context));
    }

    return this.inFlight.get(tagName);
  }

  async loadSource(url) {
    if (!url) {
      return null;
    }

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

  async resolveElementLocation(tagName, element) {
    const sourceUrl = resolveElementSourceUrl(element);

    if (!sourceUrl) {
      return null;
    }

    const source = await this.loadSource(sourceUrl);

    if (!source) {
      return null;
    }

    return createSourceLocation(sourceUrl, source, findComponentMatch(source, element, tagName));
  }

  async resolveDefinition(tagName, fallbackResolver, context = {}) {
    let definition = this.definitions.get(tagName);

    if (!definition && typeof fallbackResolver === "function") {
      definition = await fallbackResolver(tagName);

      if (definition) {
        this.definitions.set(tagName, definition);
      }
    }

    if (!definition) {
      return null;
    }

    let constructor = definition;

    if (typeof definition === "string") {
      const scriptUrl = resolveUrl(definition);
      const loadedSource = await loadClassicScript(scriptUrl, { optional: true });

      if (loadedSource === null) {
        const usageLocation = await this.resolveElementLocation(tagName, context.element);

        reportRoseltResourceError({
          kind: "component",
          resourceType: "component file",
          title: "Missing Component File",
          message: "Roselt.js could not load a referenced component script, so the element remained unenhanced.",
          reference: tagName,
          requestedUrl: scriptUrl,
          source: usageLocation?.url || resolveElementSourceUrl(context.element),
          topFrame: usageLocation
            ? {
                functionName: tagName,
                url: usageLocation.url,
                line: usageLocation.line,
                column: usageLocation.column,
              }
            : null,
          codeFrame: usageLocation?.codeFrame || null,
          stack: usageLocation ? "" : undefined,
        });
        return null;
      }

      constructor = this.definitions.get(tagName);

      if (!isCustomElementConstructor(constructor)) {
        constructor = customElements.get(tagName) ?? constructor;
      }
    } else if (!isCustomElementConstructor(definition) && typeof definition === "function") {
      const resolved = await definition();

      if (typeof resolved === "string") {
        this.definitions.set(tagName, resolved);
        return this.resolveDefinition(tagName, fallbackResolver);
      }

      constructor = resolved?.default ?? resolved;
    }

    if (!isCustomElementConstructor(constructor)) {
      throw new Error(
        `Component ${tagName} must register itself with Roselt.defineComponent(...) or customElements.define(...).`,
      );
    }

    if (!customElements.get(tagName)) {
      customElements.define(tagName, constructor);
    }

    return constructor;
  }
}

export const globalComponentRegistry = new ComponentRegistry();

export function defineComponent(tagName, constructor) {
  globalComponentRegistry.register(tagName, constructor);
}

export function lazyComponent(tagName, loader) {
  globalComponentRegistry.register(tagName, loader);
}