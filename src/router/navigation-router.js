export class NavigationRouter {
  constructor(app) {
    this.app = app;
    this.handleNavigate = this.handleNavigate.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  start() {
    if (!("navigation" in window)) {
      throw new Error("Roselt.js requires the Navigation API.");
    }

    navigation.addEventListener("navigate", this.handleNavigate);
    document.addEventListener("click", this.handleClick);
  }

  stop() {
    if ("navigation" in window) {
      navigation.removeEventListener("navigate", this.handleNavigate);
    }

    document.removeEventListener("click", this.handleClick);
  }

  async bootstrap() {
    const url = new URL(window.location.href);
    await this.app.renderUrl(url);
  }

  handleClick(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const element = target.closest("[href]");

    if (!(element instanceof Element)) {
      return;
    }

    if (element.matches("a[href], area[href]")) {
      return;
    }

    if (element.hasAttribute("download")) {
      return;
    }

    const navigationTarget = element.getAttribute("target");

    if (navigationTarget && navigationTarget !== "_self") {
      return;
    }

    const href = element.getAttribute("href");

    if (!href) {
      return;
    }

    const destinationUrl = new URL(href, window.location.href);

    if (destinationUrl.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();
    this.app.navigate(destinationUrl).catch((error) => {
      console.error("Roselt.js navigation failed.", error);
    });
  }

  handleNavigate(event) {
    if (!event.canIntercept || event.downloadRequest !== null || event.hashChange) {
      return;
    }

    const destinationUrl = new URL(event.destination.url);

    if (destinationUrl.origin !== window.location.origin) {
      return;
    }

    const routeMatch = this.app.resolve(destinationUrl);

    if (!routeMatch.route) {
      return;
    }

    event.intercept({
      scroll: "manual",
      handler: async () => {
        await this.app.renderUrl(destinationUrl, routeMatch);

        if (destinationUrl.hash) {
          const target = document.getElementById(destinationUrl.hash.slice(1));

          if (target) {
            target.scrollIntoView();
            return;
          }
        }

        event.scroll();
      },
    });
  }
}