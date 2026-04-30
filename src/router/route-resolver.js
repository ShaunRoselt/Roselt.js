import { joinUrlPath, normalizePathname, stripBasePath } from "../utils/resolve-url.js";

function normalizePageId(pageId, defaultPage) {
  if (!pageId) {
    return defaultPage;
  }

  return pageId
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\\/g, "/") || defaultPage;
}

function createAutomaticRoute(pageId, options) {
  const normalizedPageId = normalizePageId(pageId, options.defaultPage);

  return {
    name: normalizedPageId,
    query: normalizedPageId,
    path: normalizedPageId === options.defaultPage ? "/" : `/${normalizedPageId}`,
    html: `${options.pagesDirectory}/${normalizedPageId}.html`,
    module: `${options.pagesDirectory}/${normalizedPageId}.js`,
  };
}

function tokenizePath(pattern) {
  return normalizePathname(pattern)
    .split("/")
    .filter(Boolean);
}

function matchPath(pattern, pathname) {
  const patternTokens = tokenizePath(pattern);
  const pathTokens = tokenizePath(pathname);

  if (patternTokens.length !== pathTokens.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < patternTokens.length; index += 1) {
    const patternToken = patternTokens[index];
    const pathToken = pathTokens[index];

    if (patternToken.startsWith(":")) {
      params[patternToken.slice(1)] = decodeURIComponent(pathToken);
      continue;
    }

    if (patternToken !== pathToken) {
      return null;
    }
  }

  return params;
}

export function resolveRoute(routes, currentUrl, options) {
  const { routingMode, queryParam, basePath } = options;

  if (!routes.length) {
    if (routingMode === "pathname") {
      const relativePath = stripBasePath(currentUrl.pathname, basePath);
      const pageId = relativePath === "/" ? options.defaultPage : relativePath.slice(1);
      return { route: createAutomaticRoute(pageId, options), params: {} };
    }

    const pageId = currentUrl.searchParams.get(queryParam) ?? options.defaultPage;
    return { route: createAutomaticRoute(pageId, options), params: {} };
  }

  if (routingMode === "pathname") {
    const relativePath = stripBasePath(currentUrl.pathname, basePath);

    for (const route of routes) {
      if (!route.path) {
        continue;
      }

      const params = matchPath(route.path, relativePath);

      if (params) {
        return { route, params };
      }
    }
  } else {
    const requestedPage = currentUrl.searchParams.get(queryParam);

    if (requestedPage) {
      for (const route of routes) {
        if ((route.query ?? route.name) === requestedPage) {
          return { route, params: {} };
        }
      }
    }

    const defaultRoute = routes.find((route) => route.default) ?? routes[0];

    if (defaultRoute) {
      return { route: defaultRoute, params: {} };
    }
  }

  return { route: null, params: {} };
}

export function createHrefBuilder(routes, options) {
  const { routingMode, queryParam, basePath } = options;

  return function href(target, parameters = {}, sourceUrl = new URL(window.location.href)) {
    const route = !routes.length
      ? createAutomaticRoute(typeof target === "string" ? target : target?.name, options)
      : typeof target === "string"
        ? routes.find(
            (candidate) =>
              candidate.name === target ||
              candidate.query === target ||
              candidate.path === target,
          )
        : target;

    if (!route) {
      throw new Error(`Unknown route: ${target}`);
    }

    const url = new URL(sourceUrl.href);

    if (routingMode === "pathname") {
      let pathname = route.path || "/";

      pathname = pathname.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
        const value = parameters[key];

        if (value === undefined || value === null) {
          throw new Error(`Missing pathname parameter: ${key}`);
        }

        return encodeURIComponent(String(value));
      });

      url.pathname = joinUrlPath(basePath, pathname);
      url.search = "";
    } else {
      url.pathname = sourceUrl.pathname || joinUrlPath(basePath, "/");
      url.searchParams.set(queryParam, route.query ?? route.name);

      for (const [key, value] of Object.entries(parameters)) {
        if (value === undefined || value === null) {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  };
}