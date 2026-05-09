import { applyHead } from "../seo/head-manager.js";
import { resolveUrl } from "../utils/resolve-url.js";
import { createRoseltErrorMarkup, ensureRoseltErrorStyles, lockRoseltOverlayScroll, unlockRoseltOverlayScroll } from "./dev-error-overlay.js";
import { clearActivePageContext, setActivePageContext } from "./page-script.js";

const NOT_FOUND_PAGE_ID = "404";

function dedupeStylesheets(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    if (!entry?.href || seen.has(entry.href)) {
      return false;
    }

    seen.add(entry.href);
    return true;
  });
}

function resolveDefinitions(definitions = {}, baseUrl = document.baseURI) {
  return Object.fromEntries(
    Object.entries(definitions).map(([tagName, definition]) => [
      tagName,
      typeof definition === "string" ? resolveUrl(definition, baseUrl) : definition,
    ]),
  );
}

function createSiblingStylesheetUrl(htmlUrl) {
  const url = new URL(htmlUrl);

  if (!url.pathname.endsWith(".html")) {
    return null;
  }

  url.pathname = url.pathname.replace(/\.html$/, ".css");
  return url.href;
}

function normalizeInitialStylesheets(route, pageModule, pageHtmlUrl, pageModuleUrl, hasInlineStyles) {
  return dedupeStylesheets([
    ...(!hasInlineStyles
      ? [
          {
            href: createSiblingStylesheetUrl(pageHtmlUrl),
            optional: true,
          },
        ]
      : []),
    ...(route.stylesheets || []).map((href) => ({
      href: resolveUrl(href, document.baseURI),
      optional: false,
    })),
    ...(pageModule.stylesheets || []).map((href) => ({
      href: resolveUrl(href, pageModuleUrl),
      optional: false,
    })),
  ]);
}

function normalizeRuntimeStylesheets(runtimeMeta, currentUrl) {
  return dedupeStylesheets(
    (runtimeMeta?.stylesheets || []).map((href) => ({
      href: resolveUrl(href, currentUrl.href),
      optional: false,
    })),
  );
}

function extractInlineStyles(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const inlineStyles = Array.from(template.content.querySelectorAll("style"), (element) => {
    const cssText = element.textContent || "";
    element.remove();
    return cssText;
  }).filter(Boolean);

  return {
    html: template.innerHTML,
    inlineStyles,
  };
}

function createPageCleanupManager() {
  const callbacks = [];

  return {
    add(callback) {
      if (typeof callback === "function") {
        callbacks.push(callback);
      }

      return callback;
    },
    async run() {
      while (callbacks.length > 0) {
        const callback = callbacks.pop();
        await callback();
      }
    },
  };
}

function normalizeEventListenerOptions(options, signal) {
  if (typeof options === "boolean") {
    return {
      capture: options,
      signal,
    };
  }

  if (!options) {
    return { signal };
  }

  if (options.signal && typeof AbortSignal?.any === "function") {
    return {
      ...options,
      signal: AbortSignal.any([options.signal, signal]),
    };
  }

  if (options.signal) {
    return options;
  }

  return {
    ...options,
    signal,
  };
}

async function capturePageEventListeners(callback) {
  const controller = new AbortController();
  const originalAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function patchedAddEventListener(type, listener, options) {
    return originalAddEventListener.call(
      this,
      type,
      listener,
      normalizeEventListenerOptions(options, controller.signal),
    );
  };

  try {
    return {
      result: await callback(),
      cleanup() {
        controller.abort();
      },
    };
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    EventTarget.prototype.addEventListener = originalAddEventListener;
  }
}

function createPageContext(app, routeMatch, currentUrl, cleanupManager) {
  return {
    app,
    route: routeMatch.route,
    params: routeMatch.params,
    notFound: routeMatch.notFound ?? null,
    url: currentUrl,
    page: app.pageRoot,
    href: (target, parameters) => app.href(target, parameters, currentUrl),
    navigate: (target, parameters, navigationOptions) =>
      app.navigate(target, parameters, navigationOptions),
    query: Object.fromEntries(currentUrl.searchParams.entries()),
    cleanup: (callback) => cleanupManager.add(callback),
  };
}

function createNotFoundRoute(options) {
  return {
    name: NOT_FOUND_PAGE_ID,
    query: NOT_FOUND_PAGE_ID,
    path: `/${NOT_FOUND_PAGE_ID}`,
    html: `${options.pagesDirectory}/${NOT_FOUND_PAGE_ID}.html`,
    module: `${options.pagesDirectory}/${NOT_FOUND_PAGE_ID}.js`,
  };
}

function isNotFoundRoute(route) {
  return route?.name === NOT_FOUND_PAGE_ID || route?.query === NOT_FOUND_PAGE_ID;
}

export class RenderEngine {
  constructor(app, loader, sections, components) {
    this.app = app;
    this.loader = loader;
    this.sections = sections;
    this.components = components;
    this.pageCleanup = null;
    this.activeStyleElements = [];
  }

  async render(routeMatch, currentUrl) {
    if (!routeMatch.route) {
      await this.renderNotFound(currentUrl, routeMatch);
      return;
    }

    try {
      await this.renderPage(routeMatch, currentUrl);
    } catch (error) {
      if (this.loader.isMissingPageError(error)) {
        await this.renderMissingPage(routeMatch, currentUrl, error);
        return;
      }

      throw error;
    }
  }

  async renderPage(routeMatch, currentUrl) {
    const page = await this.loader.load(routeMatch.route);
    const pageUsesInlineStyles = extractInlineStyles(page.html).inlineStyles.length > 0;
    const resolvedHtml = await this.sections.resolveIncludes(page.html, page.htmlUrl);
    const extractedPage = extractInlineStyles(resolvedHtml);
    const cleanupManager = createPageCleanupManager();
    const pageContext = createPageContext(this.app, routeMatch, currentUrl, cleanupManager);
    const initialStylesheets = await Promise.all(
      normalizeInitialStylesheets(
        routeMatch.route,
        page.module,
        page.htmlUrl,
        page.moduleUrl,
        pageUsesInlineStyles,
      )
        .map((entry) => this.loader.loadStylesheet(entry.href, { optional: entry.optional })),
    );

    await this.cleanup();

    this.activeStyleElements = this.applyStyles(initialStylesheets, extractedPage.inlineStyles);

    this.app.pageRoot.setAttribute("data-roselt-page-source", page.htmlUrl);
    this.app.pageRoot.innerHTML = extractedPage.html;

    this.components.registerAll(resolveDefinitions(routeMatch.route.components, document.baseURI));
    this.components.registerAll(resolveDefinitions(page.module.components, page.moduleUrl));
    await this.components.ensureForRoot(
      this.app.pageRoot,
      (tagName) => this.app.resolveComponent(tagName),
    );
    await this.sections.hydrateRoot(this.app.pageRoot);

    setActivePageContext(pageContext);

    const loadFunction = page.module.load;
    let runtimeMeta = {};

    try {
      if (typeof loadFunction === "function") {
        const { result: mountResult, cleanup: cleanupListeners } = await capturePageEventListeners(
          () => loadFunction(pageContext),
        );
        cleanupManager.add(cleanupListeners);
        cleanupManager.add(mountResult?.destroy ?? mountResult?.cleanup ?? mountResult ?? null);
        runtimeMeta = mountResult?.meta ?? {};
      }

      this.pageCleanup = async () => {
        await cleanupManager.run();
        clearActivePageContext(pageContext);
      };

      const runtimeStylesheets = await Promise.all(
        normalizeRuntimeStylesheets(runtimeMeta, currentUrl)
          .map((entry) => this.loader.loadStylesheet(entry.href, { optional: entry.optional })),
      );

      this.activeStyleElements.push(...this.applyStyles(runtimeStylesheets));

      applyHead(routeMatch.route, page.module, runtimeMeta, currentUrl);
    } catch (error) {
      clearActivePageContext(pageContext);
      await cleanupManager.run();
      throw error;
    }
  }

  applyStyles(stylesheets, inlineStyles = []) {
    const styleElements = [];

    for (const stylesheet of stylesheets) {
      if (!stylesheet?.cssText) {
        continue;
      }

      const style = document.createElement("style");
      style.textContent = stylesheet.cssText;
      style.setAttribute("data-navigate-page-style", "true");
      style.setAttribute("data-navigate-source", stylesheet.href);
      document.head.appendChild(style);
      styleElements.push(style);
    }

    for (const cssText of inlineStyles) {
      const style = document.createElement("style");
      style.textContent = cssText;
      style.setAttribute("data-navigate-page-style", "true");
      style.setAttribute("data-navigate-source", "inline");
      document.head.appendChild(style);
      styleElements.push(style);
    }

    return styleElements;
  }

  async cleanup() {
    if (typeof this.pageCleanup === "function") {
      await this.pageCleanup();
    }

    this.pageCleanup = null;

    this.app.pageRoot.removeAttribute("data-roselt-page-source");

    for (const styleElement of this.activeStyleElements) {
      styleElement.remove();
    }

    this.activeStyleElements = [];
  }

  async renderNotFound(currentUrl, routeMatch = { route: null, params: {} }) {
    if (!isNotFoundRoute(routeMatch.route)) {
      const customNotFoundMatch = {
        route: createNotFoundRoute(this.app.options),
        params: {},
        notFound: {
          route: routeMatch.route,
          url: currentUrl,
        },
      };

      try {
        await this.renderPage(customNotFoundMatch, currentUrl);
        return;
      } catch (error) {
        if (!this.loader.isMissingPageError(error)) {
          throw error;
        }
      }
    }

    await this.cleanup();

    const section = document.createElement("section");
    const heading = document.createElement("h1");
    const description = document.createElement("p");

    heading.textContent = "Page Not Found";
    description.textContent = `No Roselt.js page matched ${currentUrl.pathname}${currentUrl.search}.`;

    section.append(heading, description);
    this.app.pageRoot.replaceChildren(section);
    document.title = "Page Not Found";
  }

  async renderMissingPage(routeMatch, currentUrl, error) {
    await this.cleanup();

    ensureRoseltErrorStyles();

    console.error(
      "[Roselt.js] Roselt.js could not load the requested page HTML, so a full-screen error page was rendered instead.",
      error,
    );

    const details = {
      kind: "page",
      resourceType: "page file",
      title: "Missing Page File",
      message: "Roselt.js could not load the requested page HTML, so a developer error page was rendered instead.",
      reference: routeMatch.route?.name || routeMatch.route?.path || currentUrl.pathname,
      requestedUrl: error?.pageUrl || routeMatch.route?.html || "",
      source: currentUrl.href,
      cause: error,
    };

    this.app.pageRoot.innerHTML = createRoseltErrorMarkup(details, { variant: "page" });

    // When showing the full-page error variant, lock the page scroll so only the overlay scrolls
    try {
      lockRoseltOverlayScroll(document);
    } catch (_) {
      // best-effort
    }

    const closeButton = this.app.pageRoot.querySelector(".roselt-runtime-error-close");

    if (closeButton instanceof HTMLButtonElement) {
      closeButton.addEventListener("click", () => {
        try {
          unlockRoseltOverlayScroll(document);
        } catch (_) {
          // best-effort
        }

        this.app.pageRoot.innerHTML = "";
      });
    }
  }
}