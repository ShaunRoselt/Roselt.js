import { globalComponentRegistry } from "./components/component-registry.js";
import { NavigationRouter } from "./router/navigation-router.js";
import { createHrefBuilder, resolveRoute } from "./router/route-resolver.js";
import { loadClassicScript } from "./runtime/classic-script-loader.js";
import { PageLoader } from "./runtime/page-loader.js";
import { clearActiveRoseltApp, setActiveRoseltApp } from "./runtime/page-script.js";
import { RenderEngine } from "./runtime/render-engine.js";
import { SectionLoader } from "./runtime/section-loader.js";
import { deriveBasePath, joinUrlPath } from "./utils/resolve-url.js";

const DEFAULT_PAGE_ROOT_SELECTOR = "roselt[page][navigate]";

function resolvePageRoot(pageRoot) {
  if (typeof pageRoot !== "string") {
    return pageRoot;
  }

  return document.querySelector(pageRoot);
}

function resolveDefaultPage(pageRoot, configuredDefaultPage) {
  if (configuredDefaultPage) {
    return configuredDefaultPage;
  }

  if (pageRoot instanceof Element && pageRoot.hasAttribute("page")) {
    return pageRoot.getAttribute("page") || "home";
  }

  return "home";
}

function createEntryAssetUrl(extension, baseUrl = document.baseURI) {
  const url = new URL(baseUrl, document.baseURI);
  const pathname = url.pathname;
  const lastSegment = pathname.split("/").pop() || "";

  if (pathname.endsWith("/")) {
    url.pathname = `${pathname}index${extension}`;
    return url.href;
  }

  if (lastSegment.endsWith(".html")) {
    url.pathname = pathname.replace(/\.html$/, extension);
    return url.href;
  }

  if (!lastSegment.includes(".")) {
    url.pathname = `${pathname.replace(/\/?$/, "/")}index${extension}`;
    return url.href;
  }

  return null;
}

function hasResolvedAssetReference(selector, attribute, assetUrl) {
  return Array.from(document.querySelectorAll(selector)).some((element) => {
    const value = element.getAttribute(attribute);
    return value && new URL(value, document.baseURI).href === assetUrl;
  });
}

function hasAppliedEntryStylesheet(assetUrl) {
  return Array.from(document.querySelectorAll("style[data-roselt-entry-style]")).some(
    (styleElement) => styleElement.getAttribute("data-roselt-entry-style") === assetUrl,
  );
}

export class Roselt {
  constructor(options = {}) {
    const {
      pageRoot = DEFAULT_PAGE_ROOT_SELECTOR,
      routes = [],
      routingMode = "query",
      queryParam = "page",
      basePath,
      components = {},
      pagesDirectory = "pages",
      sectionsDirectory = "sections",
      componentsDirectory = "components",
      defaultPage,
    } = options;

    this.routes = routes;
    this.pageRoot = resolvePageRoot(pageRoot);

    const resolvedDefaultPage = resolveDefaultPage(this.pageRoot, defaultPage);

    this.options = {
      routingMode,
      queryParam,
      basePath: basePath ?? deriveBasePath(),
      pagesDirectory,
      sectionsDirectory,
      componentsDirectory,
      defaultPage: resolvedDefaultPage,
    };

    if (!this.pageRoot) {
      throw new Error("Roselt.js could not find a roselt[page][navigate] page root.");
    }

    this.loader = new PageLoader();
    this.sections = new SectionLoader({
      sectionsDirectory: this.options.sectionsDirectory,
    });
    this.components = globalComponentRegistry;
    this.components.registerAll(components);
    this.renderer = new RenderEngine(this, this.loader, this.sections, this.components);
    this.router = new NavigationRouter(this);
    this.started = false;

    this.href = createHrefBuilder(this.routes, this.options);
  }

  async ensureEntryAssets() {
    const stylesheetUrl = createEntryAssetUrl(".css");

    if (
      stylesheetUrl &&
      !hasResolvedAssetReference('link[rel="stylesheet"][href]', "href", stylesheetUrl) &&
      !hasAppliedEntryStylesheet(stylesheetUrl)
    ) {
      const stylesheet = await this.loader.loadStylesheet(stylesheetUrl, { optional: true });

      if (stylesheet?.cssText) {
        const style = document.createElement("style");
        style.textContent = stylesheet.cssText;
        style.setAttribute("data-roselt-entry-style", stylesheet.href);
        document.head.append(style);
      }
    }

    const scriptUrl = createEntryAssetUrl(".js");

    if (scriptUrl && !hasResolvedAssetReference("script[src]", "src", scriptUrl)) {
      await loadClassicScript(scriptUrl, { optional: true });
    }
  }

  start() {
    if (this.started) {
      return Promise.resolve();
    }

    return this.ensureEntryAssets().then(() => this.sections.resolveRootIncludes(document.body)).then(async () => {
      await this.components.ensureForRoot(
        document.body,
        (tagName) => this.resolveComponent(tagName),
      );
      await this.sections.hydrateRoot(document.body);

      this.router.start();
      setActiveRoseltApp(this);
      this.started = true;
      return this.router.bootstrap();
    });
  }

  stop() {
    this.router.stop();
    clearActiveRoseltApp(this);
    this.started = false;
  }

  resolve(url) {
    return resolveRoute(this.routes, url, this.options);
  }

  async renderUrl(url, routeMatch = this.resolve(url)) {
    await this.renderer.render(routeMatch, url);
  }

  async navigate(target, parameters = {}, navigationOptions = {}) {
    const url =
      target instanceof URL
        ? target
        : new URL(this.href(target, parameters, new URL(window.location.href)));

    return navigation.navigate(url.toString(), navigationOptions).finished;
  }

  currentUrl() {
    return new URL(window.location.href);
  }

  currentRoute() {
    return this.resolve(this.currentUrl());
  }

  resolveComponent(tagName) {
    return `${this.options.componentsDirectory}/${tagName}.js`;
  }

  rootHref() {
    return joinUrlPath(this.options.basePath, "/");
  }

  static async start(options = {}) {
    const app = new Roselt(options);
    await app.start();
    return app;
  }
}

export default Roselt;