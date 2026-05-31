import { getActiveClassicScriptUrl, loadClassicScript } from "../runtime/classic-script-loader.js";
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

function createInvalidComponentRegistrationError(tagName, usageLocation, source) {
  const error = new Error(
    `Component ${tagName} must register itself by calling Roselt.defineComponent(definition) from its component file.`,
  );

  error.name = "ComponentRegistrationError";
  error.roseltRuntimeDetails = {
    source: usageLocation?.url || source || document.baseURI,
    reference: tagName,
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
  };

  return error;
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
  const pageHost = element?.closest?.("[data-roselt-page-source]");

  if (pageHost?.getAttribute) {
    return pageHost.getAttribute("data-roselt-page-source") || "";
  }

  return document.baseURI;
}

function isCustomElementConstructor(value) {
  return typeof value === "function" && value.prototype instanceof HTMLElement;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function createLightweightComponentClassName(tagName) {
  const parts = String(tagName)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return `${parts.join("") || "Roselt"}Component`;
}

function inferComponentTagNameFromFile() {
  const scriptUrl = getActiveClassicScriptUrl();

  if (!scriptUrl) {
    throw new Error(
      "Roselt.defineComponent(definition) must run while a component file is executing so Roselt can infer the component name from the filename.",
    );
  }

  const url = new URL(scriptUrl, document.baseURI);
  const fileName = decodeURIComponent(url.pathname.split("/").pop() || "");

  if (!fileName.endsWith(".js")) {
    throw new Error(
      `Roselt.defineComponent(definition) could not infer a component name from ${scriptUrl}. Component files must end in .js.`,
    );
  }

  const tagName = fileName.replace(/\.js$/, "");

  if (!tagName.includes("-")) {
    throw new Error(
      `Roselt.defineComponent(definition) inferred ${tagName} from ${fileName}, but component filenames must include a hyphen.`,
    );
  }

  return tagName;
}

const LIGHTWEIGHT_COMPONENT_STATE = Symbol("roseltLightweightComponentState");

function getLightweightState(element) {
  if (!element[LIGHTWEIGHT_COMPONENT_STATE]) {
    Object.defineProperty(element, LIGHTWEIGHT_COMPONENT_STATE, {
      value: {
        bindings: [],
        initialized: false,
      },
    });
  }

  return element[LIGHTWEIGHT_COMPONENT_STATE];
}

function getLightweightRenderRoot(element) {
  return element.shadow === false ? element : element.shadowRoot;
}

function attachLightweightBinding(element, binding) {
  const root = getLightweightRenderRoot(element);

  if (!root || binding.listener) {
    return;
  }

  binding.listener = (event) => {
    if (!binding.selector) {
      binding.handler.call(element, event, event.target, element);
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const match = event.target.closest(binding.selector);

    if (!match || !root.contains(match)) {
      return;
    }

    binding.handler.call(element, event, match, element);
  };

  root.addEventListener(binding.type, binding.listener, binding.options);
}

function renderLightweightComponent(element) {
  const root = getLightweightRenderRoot(element);

  if (!root) {
    return null;
  }

  const output = typeof element.render === "function" ? element.render.call(element, element) : element.render;
  root.innerHTML = output == null ? "" : String(output);
  return root;
}

function bindLightweightValue(element, key, value) {
  element[key] = typeof value === "function" ? value.bind(element) : value;
}

const LIGHTWEIGHT_RESERVED_KEYS = new Set([
  "attributeChanged",
  "autoRender",
  "connected",
  "disconnected",
  "observedAttributes",
  "render",
  "setup",
  "shadow",
]);

function ensureLightweightHelpers(element) {
  const state = getLightweightState(element);

  if (!Object.hasOwn(element, "on")) {
    Object.defineProperty(element, "on", {
      value(type, selector, handler, options) {
        const binding =
          typeof selector === "function"
            ? { type, selector: null, handler: selector, options: handler }
            : { type, selector, handler, options };

        state.bindings.push(binding);
        attachLightweightBinding(element, binding);
        return binding;
      },
      configurable: true,
    });
  }

  if (!Object.hasOwn(element, "emit")) {
    Object.defineProperty(element, "emit", {
      value(type, detail, options = {}) {
        const event = new CustomEvent(type, {
          detail,
          bubbles: true,
          composed: true,
          ...options,
        });

        element.dispatchEvent(event);
        return event;
      },
      configurable: true,
    });
  }

  if (!Object.hasOwn(element, "requestRender")) {
    Object.defineProperty(element, "requestRender", {
      value() {
        return renderLightweightComponent(element);
      },
      configurable: true,
    });
  }

  if (!Object.hasOwn(element, "root")) {
    Object.defineProperty(element, "root", {
      get() {
        return getLightweightRenderRoot(element);
      },
      configurable: true,
    });
  }
}

function applyLightweightDefinition(element, definition) {
  if (typeof definition === "function") {
    definition.call(element, element);
    return;
  }

  if (!isPlainObject(definition)) {
    return;
  }

  for (const [key, value] of Object.entries(definition)) {
    if (!LIGHTWEIGHT_RESERVED_KEYS.has(key)) {
      bindLightweightValue(element, key, value);
    }
  }

  if (Object.hasOwn(definition, "shadow")) {
    element.shadow = definition.shadow !== false;
  }

  if (Object.hasOwn(definition, "render")) {
    element.render = definition.render;
  }

  if (Object.hasOwn(definition, "connected")) {
    element.connected = definition.connected;
  }

  if (Object.hasOwn(definition, "disconnected")) {
    element.disconnected = definition.disconnected;
  }

  if (Object.hasOwn(definition, "attributeChanged")) {
    element.attributeChanged = definition.attributeChanged;
  }

  if (Object.hasOwn(definition, "autoRender")) {
    element.autoRender = definition.autoRender !== false;
  }

  if (typeof definition.setup === "function") {
    definition.setup.call(element, element);
  }
}

function initializeLightweightComponent(element, definition) {
  const state = getLightweightState(element);

  if (state.initialized) {
    return element;
  }

  ensureLightweightHelpers(element);
  element.shadow = element.shadow !== false;
  element.render = element.render || "";
  element.connected = element.connected || null;
  element.disconnected = element.disconnected || null;
  element.attributeChanged = element.attributeChanged || null;
  element.autoRender = element.autoRender !== false;

  applyLightweightDefinition(element, definition);

  if (element.shadow !== false && !element.shadowRoot) {
    element.attachShadow({ mode: "open" });
  }

  for (const binding of state.bindings) {
    attachLightweightBinding(element, binding);
  }

  state.initialized = true;
  return element;
}

function createLightweightComponentClass(tagName, definition) {
  const observedAttributes = Array.isArray(definition?.observedAttributes)
    ? definition.observedAttributes.map((value) => String(value))
    : [];

  const LightweightComponent = class extends HTMLElement {
    static observedAttributes = observedAttributes;

    constructor() {
      super();
      getLightweightState(this);
      ensureLightweightHelpers(this);
    }

    connectedCallback() {
      const element = initializeLightweightComponent(this, definition);
      renderLightweightComponent(element);

      if (typeof element.connected === "function") {
        element.connected.call(element, this);
      }
    }

    disconnectedCallback() {
      const element = initializeLightweightComponent(this, definition);

      if (typeof element.disconnected === "function") {
        element.disconnected.call(element, this);
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      const element = initializeLightweightComponent(this, definition);

      if (typeof element.attributeChanged === "function") {
        element.attributeChanged.call(element, name, oldValue, newValue, this);
      }

      if (oldValue !== newValue && element.autoRender !== false) {
        renderLightweightComponent(element);
      }
    }
  };

  Object.defineProperty(LightweightComponent, "name", {
    value: createLightweightComponentClassName(tagName),
  });

  return LightweightComponent;
}

function normalizeDefinedComponent(tagName, definition) {
  if (typeof definition === "function" || isPlainObject(definition)) {
    return createLightweightComponentClass(tagName, definition);
  }

  throw new Error(
    `Roselt.defineComponent(${tagName}) only accepts a lightweight definition function or object.`,
  );
}

function normalizeDefineComponentArguments(tagNameOrDefinition, maybeDefinition) {
  if (typeof tagNameOrDefinition === "string") {
    return {
      tagName: tagNameOrDefinition,
      definition: normalizeDefinedComponent(tagNameOrDefinition, maybeDefinition),
    };
  }

  const tagName = inferComponentTagNameFromFile();

  return {
    tagName,
    definition: normalizeDefinedComponent(tagName, tagNameOrDefinition),
  };
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
    }

    if (!isCustomElementConstructor(constructor)) {
      const usageLocation = await this.resolveElementLocation(tagName, context.element);

      throw createInvalidComponentRegistrationError(
        tagName,
        usageLocation,
        resolveElementSourceUrl(context.element),
      );
    }

    if (!customElements.get(tagName)) {
      customElements.define(tagName, constructor);
    }

    return constructor;
  }
}

export const globalComponentRegistry = new ComponentRegistry();

export function defineComponent(tagNameOrDefinition, maybeDefinition) {
  const { tagName, definition } = normalizeDefineComponentArguments(
    tagNameOrDefinition,
    maybeDefinition,
  );

  globalComponentRegistry.register(tagName, definition);
  return definition;
}