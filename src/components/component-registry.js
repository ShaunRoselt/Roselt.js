import { loadClassicScript } from "../runtime/classic-script-loader.js";
import { resolveUrl } from "../utils/resolve-url.js";

function isCustomElementConstructor(value) {
  return typeof value === "function" && value.prototype instanceof HTMLElement;
}

export class ComponentRegistry {
  constructor() {
    this.definitions = new Map();
    this.inFlight = new Map();
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
    const tags = new Set();

    if (root instanceof Element && root.localName.includes("-")) {
      tags.add(root.localName);
    }

    for (const element of root.querySelectorAll("*")) {
      if (element.localName.includes("-") && !customElements.get(element.localName)) {
        tags.add(element.localName);
      }
    }

    await Promise.all(Array.from(tags, (tagName) => this.load(tagName, fallbackResolver)));
  }

  async load(tagName, fallbackResolver) {
    if (customElements.get(tagName)) {
      return customElements.get(tagName);
    }

    if (!this.inFlight.has(tagName)) {
      this.inFlight.set(tagName, this.resolveDefinition(tagName, fallbackResolver));
    }

    return this.inFlight.get(tagName);
  }

  async resolveDefinition(tagName, fallbackResolver) {
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