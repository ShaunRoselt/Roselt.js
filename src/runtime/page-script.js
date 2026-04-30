import { loadClassicScript } from "./classic-script-loader.js";

function createDefinition(url) {
  return {
    url,
    exports: {},
    meta: {},
    stylesheets: [],
    components: {},
    load: null,
    promise: null,
  };
}

const definitions = new Map();
let activeDefinition = null;
let activeApp = null;
let activePageContext = null;

function withActiveDefinition(callback) {
  if (!activeDefinition) {
    return undefined;
  }

  return callback(activeDefinition);
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function requireActiveApp() {
  if (!activeApp) {
    throw new Error("Roselt has not been started yet.");
  }

  return activeApp;
}

function readCurrentRouteMatch() {
  return activeApp ? activeApp.currentRoute() : null;
}

function requireActivePageContext() {
  if (!activePageContext) {
    throw new Error("Roselt.Page runtime helpers are only available while a page is mounted.");
  }

  return activePageContext;
}

function readActivePageElement() {
  return activePageContext?.page ?? activeApp?.pageRoot ?? null;
}

function requireActivePageElement() {
  const pageElement = readActivePageElement();

  if (!pageElement) {
    throw new Error("Roselt.Page DOM helpers are only available while a page is mounted.");
  }

  return pageElement;
}

function ensurePageApi() {
  const roseltNamespace = globalThis.Roselt ?? {};

  if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "Page")) {
    Object.defineProperty(roseltNamespace, "Page", {
      enumerable: true,
      configurable: true,
      value: {
        get Title() {
          return activeDefinition?.meta.title;
        },
        set Title(value) {
          withActiveDefinition((definition) => {
            definition.meta.title = value;
          });
        },
        get Description() {
          return activeDefinition?.meta.description;
        },
        set Description(value) {
          withActiveDefinition((definition) => {
            definition.meta.description = value;
          });
        },
        get Canonical() {
          return activeDefinition?.meta.canonical;
        },
        set Canonical(value) {
          withActiveDefinition((definition) => {
            definition.meta.canonical = value;
          });
        },
        get Stylesheets() {
          return activeDefinition?.stylesheets ?? [];
        },
        set Stylesheets(value) {
          withActiveDefinition((definition) => {
            definition.stylesheets = normalizeArray(value);
          });
        },
        get Components() {
          return activeDefinition?.components ?? {};
        },
        set Components(value) {
          withActiveDefinition((definition) => {
            definition.components = value || {};
          });
        },
        get Load() {
          return activeDefinition?.load;
        },
        set Load(value) {
          withActiveDefinition((definition) => {
            definition.load = value;
          });
        },
        querySelector(selector) {
          return requireActivePageElement().querySelector(selector);
        },
        querySelectorAll(selector) {
          return requireActivePageElement().querySelectorAll(selector);
        },
        get route() {
          return activePageContext?.route ?? readCurrentRouteMatch()?.route ?? null;
        },
        get params() {
          return activePageContext?.params ?? readCurrentRouteMatch()?.params ?? {};
        },
        get notFound() {
          return activePageContext?.notFound ?? readCurrentRouteMatch()?.notFound ?? null;
        },
        get url() {
          return activePageContext?.url ?? (activeApp ? activeApp.currentUrl() : null);
        },
        get query() {
          return activePageContext?.query ?? (
            activeApp ? Object.fromEntries(activeApp.currentUrl().searchParams.entries()) : {}
          );
        },
        href(target, parameters = {}) {
          if (activePageContext) {
            return activePageContext.href(target, parameters);
          }

          return requireActiveApp().href(target, parameters);
        },
        navigate(target, parameters = {}, navigationOptions = {}) {
          if (activePageContext) {
            return activePageContext.navigate(target, parameters, navigationOptions);
          }

          return requireActiveApp().navigate(target, parameters, navigationOptions);
        },
        cleanup(callback) {
          return requireActivePageContext().cleanup(callback);
        },
      },
    });
  }

  if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "app")) {
    Object.defineProperty(roseltNamespace, "app", {
      enumerable: true,
      configurable: true,
      get() {
        return activeApp;
      },
    });
  }

  if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "navigate")) {
    Object.defineProperty(roseltNamespace, "navigate", {
      enumerable: true,
      configurable: true,
      value(target, parameters = {}, navigationOptions = {}) {
        return requireActiveApp().navigate(target, parameters, navigationOptions);
      },
    });
  }

  if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "href")) {
    Object.defineProperty(roseltNamespace, "href", {
      enumerable: true,
      configurable: true,
      value(target, parameters = {}) {
        return requireActiveApp().href(target, parameters);
      },
    });
  }

  if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "currentUrl")) {
    Object.defineProperty(roseltNamespace, "currentUrl", {
      enumerable: true,
      configurable: true,
      value() {
        return requireActiveApp().currentUrl();
      },
    });
  }

  if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "currentRoute")) {
    Object.defineProperty(roseltNamespace, "currentRoute", {
      enumerable: true,
      configurable: true,
      value() {
        return requireActiveApp().currentRoute();
      },
    });
  }

  globalThis.Roselt = roseltNamespace;
}

ensurePageApi();

export function createEmptyPageScript() {
  return createDefinition("");
}

export function setActiveRoseltApp(app) {
  activeApp = app;
}

export function clearActiveRoseltApp(app) {
  if (!app || activeApp === app) {
    activeApp = null;
  }
}

export function setActivePageContext(context) {
  activePageContext = context ?? null;
}

export function clearActivePageContext(context) {
  if (!context || activePageContext === context) {
    activePageContext = null;
  }
}

export async function loadPageScript(url) {
  if (!definitions.has(url)) {
    definitions.set(url, createDefinition(url));
  }

  const definition = definitions.get(url);

  if (!definition.promise) {
    definition.promise = (async () => {
      activeDefinition = definition;

      try {
        const source = await loadClassicScript(url, { optional: true });
        definition.exports = source === null ? {} : definition.exports;

        return definition;
      } finally {
        activeDefinition = null;
      }
    })();
  }

  return definition.promise;
}

export function normalizePageScript(definition) {
  return {
    meta: {
      ...(definition?.meta || {}),
    },
    stylesheets: [...(definition?.stylesheets || [])],
    components: {
      ...(definition?.components || {}),
    },
    load: definition?.load ?? null,
  };
}