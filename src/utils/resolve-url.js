export function resolveUrl(resourcePath, baseUrl = document.baseURI) {
  return new URL(resourcePath, baseUrl).href;
}

function normalizeDirectoryPathname(pathname) {
  if (!pathname) {
    return "/";
  }

  return pathname.endsWith("/")
    ? pathname
    : pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/";
}

export function createDocumentRelativeSpecifier(targetUrl, documentUrl = document.baseURI) {
  const documentLocation = new URL(documentUrl, document.baseURI);
  const fromSegments = normalizeDirectoryPathname(documentLocation.pathname)
    .split("/")
    .filter(Boolean);
  const toSegments = targetUrl.pathname.split("/").filter(Boolean);

  let sharedSegmentCount = 0;

  while (
    sharedSegmentCount < fromSegments.length &&
    sharedSegmentCount < toSegments.length &&
    fromSegments[sharedSegmentCount] === toSegments[sharedSegmentCount]
  ) {
    sharedSegmentCount += 1;
  }

  const upSegments = new Array(fromSegments.length - sharedSegmentCount).fill("..");
  const downSegments = toSegments.slice(sharedSegmentCount);
  const relativePath = [...upSegments, ...downSegments].join("/") || ".";
  const prefixedPath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;

  return `${prefixedPath}${targetUrl.search}${targetUrl.hash}`;
}

export function resolveBrowserLoadUrl(resourcePath, baseUrl = document.baseURI) {
  const resolvedUrl = new URL(resourcePath, baseUrl);
  const documentUrl = new URL(document.baseURI);

  if (documentUrl.protocol === "file:" && resolvedUrl.protocol === "file:") {
    return createDocumentRelativeSpecifier(resolvedUrl, documentUrl.href);
  }

  return resolvedUrl.href;
}

export function deriveBasePath(baseUrl = document.baseURI) {
  const url = new URL(baseUrl, document.baseURI);
  const pathname = url.pathname;

  if (pathname.endsWith("/")) {
    return stripTrailingSlash(pathname);
  }

  const segments = pathname.split("/");
  segments.pop();

  const directory = segments.join("/") || "/";
  return stripTrailingSlash(directory);
}

export function stripTrailingSlash(value) {
  if (!value || value === "/") {
    return "/";
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function normalizePathname(pathname) {
  if (!pathname) {
    return "/";
  }

  const value = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}

export function joinUrlPath(basePath, pathname) {
  const normalizedBase = stripTrailingSlash(basePath || "/");
  const normalizedPath = normalizePathname(pathname);

  if (normalizedBase === "/") {
    return normalizedPath;
  }

  return normalizedPath === "/"
    ? normalizedBase
    : `${normalizedBase}${normalizedPath}`;
}

export function stripBasePath(pathname, basePath) {
  const normalizedPath = normalizePathname(pathname);
  const normalizedBase = stripTrailingSlash(basePath || "/");

  if (normalizedBase === "/") {
    return normalizedPath;
  }

  if (normalizedPath === normalizedBase) {
    return "/";
  }

  if (normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizedPath.slice(normalizedBase.length) || "/";
  }

  return normalizedPath;
}