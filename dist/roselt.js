"use strict";
(() => {
  // src/utils/resolve-url.js
  function resolveUrl(resourcePath, baseUrl = document.baseURI) {
    return new URL(resourcePath, baseUrl).href;
  }
  function normalizeDirectoryPathname(pathname) {
    if (!pathname) {
      return "/";
    }
    return pathname.endsWith("/") ? pathname : pathname.slice(0, pathname.lastIndexOf("/") + 1) || "/";
  }
  function createDocumentRelativeSpecifier(targetUrl, documentUrl = document.baseURI) {
    const documentLocation = new URL(documentUrl, document.baseURI);
    const fromSegments = normalizeDirectoryPathname(documentLocation.pathname).split("/").filter(Boolean);
    const toSegments = targetUrl.pathname.split("/").filter(Boolean);
    let sharedSegmentCount = 0;
    while (sharedSegmentCount < fromSegments.length && sharedSegmentCount < toSegments.length && fromSegments[sharedSegmentCount] === toSegments[sharedSegmentCount]) {
      sharedSegmentCount += 1;
    }
    const upSegments = new Array(fromSegments.length - sharedSegmentCount).fill("..");
    const downSegments = toSegments.slice(sharedSegmentCount);
    const relativePath = [...upSegments, ...downSegments].join("/") || ".";
    const prefixedPath = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
    return `${prefixedPath}${targetUrl.search}${targetUrl.hash}`;
  }
  function resolveBrowserLoadUrl(resourcePath, baseUrl = document.baseURI) {
    const resolvedUrl = new URL(resourcePath, baseUrl);
    const documentUrl = new URL(document.baseURI);
    if (documentUrl.protocol === "file:" && resolvedUrl.protocol === "file:") {
      return createDocumentRelativeSpecifier(resolvedUrl, documentUrl.href);
    }
    return resolvedUrl.href;
  }
  function deriveBasePath(baseUrl = document.baseURI) {
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
  function stripTrailingSlash(value) {
    if (!value || value === "/") {
      return "/";
    }
    return value.endsWith("/") ? value.slice(0, -1) : value;
  }
  function normalizePathname(pathname) {
    if (!pathname) {
      return "/";
    }
    const value = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  }
  function joinUrlPath(basePath, pathname) {
    const normalizedBase = stripTrailingSlash(basePath || "/");
    const normalizedPath = normalizePathname(pathname);
    if (normalizedBase === "/") {
      return normalizedPath;
    }
    return normalizedPath === "/" ? normalizedBase : `${normalizedBase}${normalizedPath}`;
  }
  function stripBasePath(pathname, basePath) {
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

  // src/runtime/classic-script-loader.js
  var sourceCache = /* @__PURE__ */ new Map();
  var executionCache = /* @__PURE__ */ new Map();
  function isMissingScriptError(error) {
    const message = String(error);
    return error instanceof TypeError || message.includes("Failed to fetch") || message.includes("NetworkError");
  }
  function sourceUsesModuleSyntax(source) {
    return /^\s*(import|export)\b/m.test(source);
  }
  async function readClassicScriptSource(url, { optional = false } = {}) {
    if (!sourceCache.has(url)) {
      sourceCache.set(
        url,
        fetch(resolveBrowserLoadUrl(url)).then(async (response) => {
          if (!response.ok) {
            if (optional) {
              return null;
            }
            throw new Error(`Failed to load script: ${url}`);
          }
          return response.text();
        }).catch((error) => {
          if (optional && isMissingScriptError(error)) {
            return null;
          }
          throw error;
        })
      );
    }
    return sourceCache.get(url);
  }
  function executeClassicScript(source, url) {
    const script = document.createElement("script");
    script.textContent = `(function () {
${source}
}).call(globalThis);
//# sourceURL=${url}`;
    document.head.append(script);
    script.remove();
  }
  async function loadClassicScript(url, { optional = false } = {}) {
    const cacheKey = `${optional ? "optional" : "required"}:${url}`;
    if (!executionCache.has(cacheKey)) {
      executionCache.set(
        cacheKey,
        (async () => {
          const source = await readClassicScriptSource(url, { optional });
          if (source === null) {
            return null;
          }
          if (sourceUsesModuleSyntax(source)) {
            throw new Error(
              `Roselt.js no longer supports ES module page or component scripts. Convert ${url} to a classic script.`
            );
          }
          executeClassicScript(source, url);
          return source;
        })()
      );
    }
    return executionCache.get(cacheKey);
  }

  // src/runtime/dev-error-overlay.js
  var STYLE_ID = "roselt-runtime-error-style";
  var PANEL_ID = "roselt-runtime-error-panel";
  var errorEntries = [];
  var errorKeys = /* @__PURE__ */ new Set();
  var pendingCodeFrames = /* @__PURE__ */ new Map();
  var dismissed = false;
  var _overlayActive = false;
  var _prevHtmlOverflow = null;
  var _prevBodyOverflow = null;
  function readErrorName(cause) {
    return cause?.name || "Error";
  }
  function readErrorMessage(details = {}) {
    if (details.message) {
      return details.message;
    }
    if (details.cause?.message) {
      return details.cause.message;
    }
    return `Roselt.js could not load the ${details.resourceType || details.kind || "resource"}.`;
  }
  function readStackString(cause) {
    return typeof cause?.stack === "string" ? cause.stack : "";
  }
  function trimFunctionName(value) {
    return String(value || "").replace(/^async\s+/, "").trim();
  }
  function shortenUrl(url) {
    if (!url) {
      return "";
    }
    try {
      const parsed = new URL(url, document.baseURI);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return String(url);
    }
  }
  function parseStackFrames(stack) {
    const frames = [];
    for (const line of String(stack || "").split("\n")) {
      const chromiumMatch = line.match(/^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (chromiumMatch) {
        frames.push({
          functionName: trimFunctionName(chromiumMatch[1]),
          url: chromiumMatch[2],
          line: Number(chromiumMatch[3]),
          column: Number(chromiumMatch[4])
        });
        continue;
      }
      const firefoxMatch = line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
      if (firefoxMatch) {
        frames.push({
          functionName: trimFunctionName(firefoxMatch[1]),
          url: firefoxMatch[2],
          line: Number(firefoxMatch[3]),
          column: Number(firefoxMatch[4])
        });
      }
    }
    return frames;
  }
  function formatStackFrame(frame) {
    if (!frame?.url || !frame?.line || !frame?.column) {
      return "";
    }
    const location = `${shortenUrl(frame.url)}:${frame.line}:${frame.column}`;
    if (frame.functionName) {
      return `${frame.functionName} (${location})`;
    }
    return location;
  }
  function canFetchCodeFrame(url) {
    if (typeof window === "undefined" || !url) {
      return false;
    }
    try {
      const parsed = new URL(url, document.baseURI);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  function extractCodeFrame(source, lineNumber) {
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
        highlight: startLine + index === lineNumber
      }))
    };
  }
  function renderCodeFrameMarkup(codeFrame) {
    if (!codeFrame?.lines?.length) {
      return "";
    }
    return `
    <section class="roselt-runtime-error-codeframe">
      <h4>Source</h4>
      <pre>${codeFrame.lines.map(
      (line) => `<div class="roselt-runtime-error-codeframe-line${line.highlight ? " is-highlighted" : ""}"><span class="roselt-runtime-error-gutter">${line.lineNumber}</span><span class="roselt-runtime-error-code">${escapeHtml(line.text || " ")}</span></div>`
    ).join("")}</pre>
    </section>
  `;
  }
  async function enrichErrorWithCodeFrame(details) {
    if (details.codeFrame || !details.topFrame?.url || !details.topFrame?.line) {
      return;
    }
    if (!canFetchCodeFrame(details.topFrame.url)) {
      return;
    }
    const cacheKey = `${details.topFrame.url}:${details.topFrame.line}`;
    if (!pendingCodeFrames.has(cacheKey)) {
      pendingCodeFrames.set(
        cacheKey,
        fetch(details.topFrame.url).then((response) => response.ok ? response.text() : null).then((source) => extractCodeFrame(source, details.topFrame.line)).catch(() => null)
      );
    }
    const codeFrame = await pendingCodeFrames.get(cacheKey);
    if (codeFrame) {
      details.codeFrame = codeFrame;
      renderPanel();
    }
  }
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }
  function formatLabel(value) {
    return String(value || "resource").replaceAll(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
  }
  function createErrorKey(details) {
    return [
      details.kind,
      details.resourceType,
      details.reference,
      details.requestedUrl,
      details.source,
      details.message
    ].filter(Boolean).join("|");
  }
  function normalizeDetails(details = {}) {
    const message = readErrorMessage(details);
    const stack = details.stack || readStackString(details.cause);
    const stackFrames = parseStackFrames(stack);
    const topFrame = details.topFrame || stackFrames[0] || null;
    const errorName = details.errorName || readErrorName(details.cause);
    return {
      kind: details.kind || "resource",
      resourceType: details.resourceType || details.kind || "resource",
      title: details.title || `Missing ${formatLabel(details.resourceType || details.kind || "resource")}`,
      message,
      errorName,
      reference: details.reference || "",
      requestedUrl: details.requestedUrl || "",
      source: details.source || "",
      cause: details.cause || null,
      stack,
      stackFrames,
      topFrame,
      codeFrame: details.codeFrame || null
    };
  }
  function createMetadataRows(details) {
    return [
      details.errorName ? ["Type", details.errorName] : null,
      details.topFrame ? ["Location", formatStackFrame(details.topFrame)] : null,
      details.reference ? ["Reference", details.reference] : null,
      details.source ? ["Referenced From", details.source] : null,
      details.requestedUrl ? ["Resolved URL", details.requestedUrl] : null,
      details.cause?.message ? ["Cause", details.cause.message] : null
    ].filter(Boolean);
  }
  function createStackMarkup(details) {
    if (!details.stack) {
      return "";
    }
    return `
    <section class="roselt-runtime-error-stack">
      <h4>Stack Trace</h4>
      <pre>${escapeHtml(details.stack)}</pre>
    </section>
  `;
  }
  function createEntryMarkup(details) {
    const metadata = createMetadataRows(details).map(
      ([label, value]) => `<div class="roselt-runtime-error-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    ).join("");
    return `
    <li class="roselt-runtime-error-item">
      <div class="roselt-runtime-error-badge">ERROR</div>
      <h3>${escapeHtml(details.title)}</h3>
      <p>${escapeHtml(details.message)}</p>
      ${metadata ? `<dl>${metadata}</dl>` : ""}
      ${renderCodeFrameMarkup(details.codeFrame)}
      ${createStackMarkup(details)}
    </li>
  `;
  }
  function createPanelCopy(entries) {
    if (entries.some((entry) => entry.kind === "runtime")) {
      return {
        heading: "Uncaught runtime errors:",
        description: "Roselt.js caught an uncaught error and kept the current app visible so you can inspect the failure."
      };
    }
    return {
      heading: "Roselt.js Missing Files",
      description: "Rendering continued where possible so you can inspect the rest of the app."
    };
  }
  function ensureStyles(documentRef) {
    if (documentRef.getElementById(STYLE_ID)) {
      return;
    }
    const style = documentRef.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      inset: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      align-items: stretch;
      padding: 24px;
      box-sizing: border-box;
      overflow-x: hidden;
      overflow-y: auto;
      z-index: 2147483647;
      background: #111111;
      color: #f3f4f6;
      font: 14px/1.55 "IBM Plex Sans", "Segoe UI", sans-serif;
    }

    #${PANEL_ID},
    #${PANEL_ID} *,
    .roselt-runtime-error-placeholder,
    .roselt-runtime-error-placeholder * {
      box-sizing: border-box;
    }

    #${PANEL_ID}[hidden] {
      display: none;
    }

    #${PANEL_ID} .roselt-runtime-error-shell {
      width: min(1180px, 100%);
      margin: auto;
      min-height: calc(100vh - 48px);
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 20px;
      overflow-x: hidden;
    }

    #${PANEL_ID} .roselt-runtime-error-header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      justify-content: space-between;
      padding: 0;
    }

    #${PANEL_ID} .roselt-runtime-error-header h2 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 2.6rem);
      line-height: 1.2;
      color: #ff5f56;
    }

    #${PANEL_ID} .roselt-runtime-error-header p {
      margin: 6px 0 0;
      color: #c7c7c7;
    }

    #${PANEL_ID} .roselt-runtime-error-close {
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #fff;
      width: 36px;
      height: 36px;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
      flex: none;
    }

    #${PANEL_ID} .roselt-runtime-error-content {
      display: grid;
      align-content: start;
      gap: 16px;
      min-width: 0;
      overflow-x: hidden;
    }

    #${PANEL_ID} .roselt-runtime-error-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 16px;
      min-width: 0;
    }

    #${PANEL_ID} .roselt-runtime-error-item,
    .roselt-runtime-error-placeholder {
      background: #2a1717;
      border: 1px solid #523030;
      border-radius: 0;
      padding: 20px;
      color: #f3f4f6;
      min-width: 0;
      overflow-x: hidden;
    }

    #${PANEL_ID} .roselt-runtime-error-badge,
    .roselt-runtime-error-placeholder .roselt-runtime-error-badge {
      margin: 0 0 12px;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #ff5f56;
    }

    #${PANEL_ID} .roselt-runtime-error-item h3,
    .roselt-runtime-error-placeholder h2,
    .roselt-runtime-error-placeholder h3 {
      margin: 0 0 8px;
      font-size: 2rem;
      line-height: 1.35;
      color: #ff7b72;
    }

    #${PANEL_ID} .roselt-runtime-error-item p,
    .roselt-runtime-error-placeholder p {
      margin: 0 0 10px;
      color: #f3d6d6;
    }

    #${PANEL_ID} .roselt-runtime-error-item dl,
    .roselt-runtime-error-placeholder dl {
      margin: 0;
      display: grid;
      gap: 8px;
    }

    #${PANEL_ID} .roselt-runtime-error-row,
    .roselt-runtime-error-placeholder .roselt-runtime-error-row {
      display: grid;
      gap: 4px;
    }

    #${PANEL_ID} dt,
    .roselt-runtime-error-placeholder dt {
      font-weight: 600;
      color: #fca5a5;
    }

    #${PANEL_ID} dd,
    .roselt-runtime-error-placeholder dd {
      margin: 0;
      font-family: "IBM Plex Mono", "Consolas", monospace;
      font-size: 13px;
      color: #f8e6e6;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    #${PANEL_ID} .roselt-runtime-error-stack,
    #${PANEL_ID} .roselt-runtime-error-codeframe,
    .roselt-runtime-error-placeholder .roselt-runtime-error-stack,
    .roselt-runtime-error-placeholder .roselt-runtime-error-codeframe {
      display: grid;
      gap: 8px;
      margin-top: 16px;
    }

    #${PANEL_ID} .roselt-runtime-error-stack h4,
    #${PANEL_ID} .roselt-runtime-error-codeframe h4,
    .roselt-runtime-error-placeholder .roselt-runtime-error-stack h4,
    .roselt-runtime-error-placeholder .roselt-runtime-error-codeframe h4 {
      margin: 0;
      font-size: 0.95rem;
      color: #fca5a5;
    }

    #${PANEL_ID} .roselt-runtime-error-stack pre,
    #${PANEL_ID} .roselt-runtime-error-codeframe pre,
    .roselt-runtime-error-placeholder .roselt-runtime-error-stack pre,
    .roselt-runtime-error-placeholder .roselt-runtime-error-codeframe pre {
      margin: 0;
      padding: 14px;
      background: #130d0d;
      border: 1px solid #3a2323;
      overflow: visible;
      color: #f5e4e4;
      font: 13px/1.55 "IBM Plex Mono", "Consolas", monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }

    #${PANEL_ID} .roselt-runtime-error-codeframe-line,
    .roselt-runtime-error-placeholder .roselt-runtime-error-codeframe-line {
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 12px;
      padding: 1px 0;
    }

    #${PANEL_ID} .roselt-runtime-error-codeframe-line.is-highlighted,
    .roselt-runtime-error-placeholder .roselt-runtime-error-codeframe-line.is-highlighted {
      background: rgba(255, 95, 86, 0.12);
    }

    #${PANEL_ID} .roselt-runtime-error-gutter,
    .roselt-runtime-error-placeholder .roselt-runtime-error-gutter {
      color: #fca5a5;
      text-align: right;
      user-select: none;
    }

    #${PANEL_ID} .roselt-runtime-error-code,
    .roselt-runtime-error-placeholder .roselt-runtime-error-code {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .roselt-runtime-error-placeholder[data-roselt-error-variant="page"] {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      padding: 24px;
      margin: 0;
      border: 0;
      border-radius: 0;
      background: #111111;
      color: #f3f4f6;
      overflow-x: hidden;
      overflow-y: auto;
    }

    .roselt-runtime-error-placeholder[data-roselt-error-variant="page"] .roselt-runtime-error-page-shell {
      width: min(960px, 100%);
      border: 1px solid #523030;
      border-radius: 0;
      background: #2a1717;
      padding: 24px;
      display: grid;
      gap: 16px;
      min-width: 0;
      overflow-x: hidden;
    }

    .roselt-runtime-error-placeholder[data-roselt-error-variant="page"] .roselt-runtime-error-close {
      position: absolute;
      top: 24px;
      right: 24px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #fff;
      width: 40px;
      height: 40px;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }
  `;
    documentRef.head.append(style);
  }
  function ensureRoseltErrorStyles(documentRef = document) {
    if (typeof documentRef === "undefined" || !documentRef.head) {
      return;
    }
    ensureStyles(documentRef);
  }
  function ensurePanel(documentRef) {
    let panel = documentRef.getElementById(PANEL_ID);
    if (panel) {
      return panel;
    }
    panel = documentRef.createElement("aside");
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.innerHTML = `
    <div class="roselt-runtime-error-shell">
      <div class="roselt-runtime-error-header">
        <div>
          <h2 class="roselt-runtime-error-title">Roselt.js Missing Files</h2>
          <p class="roselt-runtime-error-description">Rendering continued where possible so you can inspect the rest of the app.</p>
        </div>
        <button class="roselt-runtime-error-close" type="button" aria-label="Close Roselt.js error panel">\xD7</button>
      </div>
      <div class="roselt-runtime-error-content">
        <ol class="roselt-runtime-error-list"></ol>
      </div>
    </div>
  `;
    panel.querySelector(".roselt-runtime-error-close")?.addEventListener("click", () => {
      dismissed = true;
      panel.hidden = true;
      try {
        unlockRoseltOverlayScroll(documentRef);
      } catch (_) {
      }
    });
    documentRef.body.append(panel);
    return panel;
  }
  function renderPanel() {
    if (typeof document === "undefined" || !document.body || !document.head) {
      return;
    }
    ensureStyles(document);
    const panel = ensurePanel(document);
    const list = panel.querySelector(".roselt-runtime-error-list");
    const heading = panel.querySelector(".roselt-runtime-error-title");
    const description = panel.querySelector(".roselt-runtime-error-description");
    const copy = createPanelCopy(errorEntries);
    if (heading) {
      heading.textContent = copy.heading;
    }
    if (description) {
      description.textContent = copy.description;
    }
    if (list) {
      list.innerHTML = errorEntries.map((entry) => createEntryMarkup(entry)).join("");
    }
    panel.hidden = dismissed || errorEntries.length === 0;
    try {
      if (!panel.hidden) {
        lockRoseltOverlayScroll(document);
      } else {
        unlockRoseltOverlayScroll(document);
      }
    } catch (_) {
    }
  }
  function lockRoseltOverlayScroll(documentRef = document) {
    if (typeof documentRef === "undefined" || !documentRef.documentElement || !documentRef.body) {
      return;
    }
    if (_overlayActive) {
      return;
    }
    try {
      _prevHtmlOverflow = documentRef.documentElement.style.overflow ?? "";
      _prevBodyOverflow = documentRef.body.style.overflow ?? "";
      documentRef.documentElement.style.overflow = "hidden";
      documentRef.body.style.overflow = "hidden";
      _overlayActive = true;
    } catch (_) {
    }
  }
  function unlockRoseltOverlayScroll(documentRef = document) {
    if (typeof documentRef === "undefined" || !documentRef.documentElement || !documentRef.body) {
      return;
    }
    if (!_overlayActive) {
      return;
    }
    try {
      documentRef.documentElement.style.overflow = _prevHtmlOverflow ?? "";
      documentRef.body.style.overflow = _prevBodyOverflow ?? "";
    } catch (_) {
    }
    _overlayActive = false;
    _prevHtmlOverflow = null;
    _prevBodyOverflow = null;
  }
  function reportRoseltResourceError(details) {
    const normalized = normalizeDetails(details);
    const key = createErrorKey(normalized);
    ensureRoseltErrorStyles();
    if (!errorKeys.has(key)) {
      errorKeys.add(key);
      errorEntries.push(normalized);
      dismissed = false;
      console.error(`[Roselt.js] ${normalized.message}`, normalized.cause || normalized);
      void enrichErrorWithCodeFrame(normalized);
    }
    renderPanel();
    return normalized;
  }
  function reportRoseltRuntimeError(error, details = {}) {
    const cause = error instanceof Error ? error : new Error(String(error || "Unknown runtime error"));
    const normalized = normalizeDetails({
      kind: "runtime",
      resourceType: "runtime error",
      title: `${readErrorName(cause)}: ${readErrorMessage({ message: details.message, cause })}`,
      message: details.description || "An uncaught runtime error happened while Roselt.js was running the current page.",
      reference: details.reference || "",
      requestedUrl: details.requestedUrl || details.filename || "",
      source: details.source || window.location.href,
      cause
    });
    const key = createErrorKey(normalized);
    ensureRoseltErrorStyles();
    if (!errorKeys.has(key)) {
      errorKeys.add(key);
      errorEntries.push(normalized);
      dismissed = false;
      console.error(`[Roselt.js] ${normalized.title}`, cause);
      void enrichErrorWithCodeFrame(normalized);
    }
    renderPanel();
    return normalized;
  }
  function createRoseltErrorMarkup(details, { variant = "inline" } = {}) {
    const normalized = normalizeDetails(details);
    const metadata = createMetadataRows(normalized).map(
      ([label, value]) => `<div class="roselt-runtime-error-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    ).join("");
    return `
    <section class="roselt-runtime-error-placeholder" data-roselt-error-variant="${escapeHtml(variant)}">
      ${variant === "page" ? '<button class="roselt-runtime-error-close" type="button" aria-label="Close error page">\xD7</button>' : ""}
      <div class="roselt-runtime-error-page-shell">
        <div class="roselt-runtime-error-badge">ERROR</div>
        <h${variant === "page" ? "2" : "3"}>${escapeHtml(normalized.title)}</h${variant === "page" ? "2" : "3"}>
        <p>${escapeHtml(normalized.message)}</p>
        ${metadata ? `<dl>${metadata}</dl>` : ""}
        ${renderCodeFrameMarkup(normalized.codeFrame)}
        ${createStackMarkup(normalized)}
      </div>
    </section>
  `;
  }

  // src/components/component-registry.js
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
        highlight: startLine + index === lineNumber
      }))
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
      codeFrame: createCodeFrame(source, line)
    };
  }
  function findComponentMatch(source, element, tagName) {
    const exactMarkup = element?.outerHTML;
    if (exactMarkup) {
      const exactIndex = source.indexOf(exactMarkup);
      if (exactIndex >= 0) {
        return {
          index: exactIndex,
          text: exactMarkup
        };
      }
    }
    const tagPattern = new RegExp(
      `<${escapeRegExp(tagName)}\\b[^>]*>(?:[\\s\\S]*?<\\/${escapeRegExp(tagName)}>)?`,
      "i"
    );
    const match = tagPattern.exec(source);
    if (match) {
      return {
        index: match.index,
        text: match[0]
      };
    }
    const selfClosingPattern = new RegExp(`<${escapeRegExp(tagName)}\\b[^>]*\\/>`, "i");
    const selfClosingMatch = selfClosingPattern.exec(source);
    if (!selfClosingMatch) {
      return null;
    }
    return {
      index: selfClosingMatch.index,
      text: selfClosingMatch[0]
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
  var ComponentRegistry = class {
    constructor() {
      this.definitions = /* @__PURE__ */ new Map();
      this.inFlight = /* @__PURE__ */ new Map();
      this.sourceCache = /* @__PURE__ */ new Map();
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
    registerAll(definitions2 = {}) {
      for (const [tagName, definition] of Object.entries(definitions2)) {
        this.register(tagName, definition);
      }
    }
    async ensureForRoot(root, fallbackResolver) {
      const tagElements = /* @__PURE__ */ new Map();
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
        Array.from(
          tagElements,
          ([tagName, element]) => this.load(tagName, fallbackResolver, { element })
        )
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
          fetch(resolveBrowserLoadUrl(url)).then(async (response) => response.ok ? response.text() : null).catch(() => null)
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
            topFrame: usageLocation ? {
              functionName: tagName,
              url: usageLocation.url,
              line: usageLocation.line,
              column: usageLocation.column
            } : null,
            codeFrame: usageLocation?.codeFrame || null,
            stack: usageLocation ? "" : void 0
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
          `Component ${tagName} must register itself with Roselt.defineComponent(...) or customElements.define(...).`
        );
      }
      if (!customElements.get(tagName)) {
        customElements.define(tagName, constructor);
      }
      return constructor;
    }
  };
  var globalComponentRegistry = new ComponentRegistry();
  function defineComponent(tagName, constructor) {
    globalComponentRegistry.register(tagName, constructor);
  }
  function lazyComponent(tagName, loader) {
    globalComponentRegistry.register(tagName, loader);
  }

  // src/router/navigation-router.js
  var NavigationRouter = class {
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
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
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
        }
      });
    }
  };

  // src/router/route-resolver.js
  function normalizePageId(pageId, defaultPage) {
    if (!pageId) {
      return defaultPage;
    }
    return pageId.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\\/g, "/") || defaultPage;
  }
  function createAutomaticRoute(pageId, options) {
    const normalizedPageId = normalizePageId(pageId, options.defaultPage);
    return {
      name: normalizedPageId,
      query: normalizedPageId,
      path: normalizedPageId === options.defaultPage ? "/" : `/${normalizedPageId}`,
      html: `${options.pagesDirectory}/${normalizedPageId}.html`,
      module: `${options.pagesDirectory}/${normalizedPageId}.js`
    };
  }
  function tokenizePath(pattern) {
    return normalizePathname(pattern).split("/").filter(Boolean);
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
  function resolveRoute(routes, currentUrl, options) {
    const { routingMode, queryParam, basePath } = options;
    if (!routes.length) {
      if (routingMode === "pathname") {
        const relativePath = stripBasePath(currentUrl.pathname, basePath);
        const pageId2 = relativePath === "/" ? options.defaultPage : relativePath.slice(1);
        return { route: createAutomaticRoute(pageId2, options), params: {} };
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
  function createHrefBuilder(routes, options) {
    const { routingMode, queryParam, basePath } = options;
    return function href(target, parameters = {}, sourceUrl = new URL(window.location.href)) {
      const route = !routes.length ? createAutomaticRoute(typeof target === "string" ? target : target?.name, options) : typeof target === "string" ? routes.find(
        (candidate) => candidate.name === target || candidate.query === target || candidate.path === target
      ) : target;
      if (!route) {
        throw new Error(`Unknown route: ${target}`);
      }
      const url = new URL(sourceUrl.href);
      if (routingMode === "pathname") {
        let pathname = route.path || "/";
        pathname = pathname.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
          const value = parameters[key];
          if (value === void 0 || value === null) {
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
          if (value === void 0 || value === null) {
            url.searchParams.delete(key);
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
      return url.toString();
    };
  }

  // src/runtime/page-script.js
  function createDefinition(url) {
    return {
      url,
      exports: {},
      meta: {},
      stylesheets: [],
      components: {},
      load: null,
      promise: null
    };
  }
  var definitions = /* @__PURE__ */ new Map();
  var activeDefinition = null;
  var activeApp = null;
  var activePageContext = null;
  function withActiveDefinition(callback) {
    if (!activeDefinition) {
      return void 0;
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
            return activePageContext?.query ?? (activeApp ? Object.fromEntries(activeApp.currentUrl().searchParams.entries()) : {});
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
          }
        }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "app")) {
      Object.defineProperty(roseltNamespace, "app", {
        enumerable: true,
        configurable: true,
        get() {
          return activeApp;
        }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "navigate")) {
      Object.defineProperty(roseltNamespace, "navigate", {
        enumerable: true,
        configurable: true,
        value(target, parameters = {}, navigationOptions = {}) {
          return requireActiveApp().navigate(target, parameters, navigationOptions);
        }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "href")) {
      Object.defineProperty(roseltNamespace, "href", {
        enumerable: true,
        configurable: true,
        value(target, parameters = {}) {
          return requireActiveApp().href(target, parameters);
        }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "currentUrl")) {
      Object.defineProperty(roseltNamespace, "currentUrl", {
        enumerable: true,
        configurable: true,
        value() {
          return requireActiveApp().currentUrl();
        }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(roseltNamespace, "currentRoute")) {
      Object.defineProperty(roseltNamespace, "currentRoute", {
        enumerable: true,
        configurable: true,
        value() {
          return requireActiveApp().currentRoute();
        }
      });
    }
    globalThis.Roselt = roseltNamespace;
  }
  ensurePageApi();
  function createEmptyPageScript() {
    return createDefinition("");
  }
  function setActiveRoseltApp(app) {
    activeApp = app;
  }
  function clearActiveRoseltApp(app) {
    if (!app || activeApp === app) {
      activeApp = null;
    }
  }
  function setActivePageContext(context) {
    activePageContext = context ?? null;
  }
  function clearActivePageContext(context) {
    if (!context || activePageContext === context) {
      activePageContext = null;
    }
  }
  async function loadPageScript(url) {
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
  function normalizePageScript(definition) {
    return {
      meta: {
        ...definition?.meta || {}
      },
      stylesheets: [...definition?.stylesheets || []],
      components: {
        ...definition?.components || {}
      },
      load: definition?.load ?? null
    };
  }

  // src/runtime/page-loader.js
  function createMissingPageError(url, cause) {
    const error = new Error(`Failed to load page HTML: ${url}`);
    error.code = "ROSELT_PAGE_NOT_FOUND";
    error.pageUrl = url;
    error.cause = cause;
    return error;
  }
  function isMissingPageFetchError(error) {
    if (error?.code === "ROSELT_PAGE_NOT_FOUND") {
      return true;
    }
    const message = String(error);
    return error instanceof TypeError || message.includes("Failed to fetch") || message.includes("NetworkError");
  }
  var PageLoader = class {
    constructor() {
      this.htmlCache = /* @__PURE__ */ new Map();
      this.moduleCache = /* @__PURE__ */ new Map();
      this.stylesheetCache = /* @__PURE__ */ new Map();
    }
    async load(route) {
      const htmlUrl = route.html ? resolveUrl(route.html) : route.htmlUrl ? resolveUrl(route.htmlUrl) : document.baseURI;
      const moduleUrl = typeof route.module === "string" ? resolveUrl(route.module) : route.moduleUrl ? resolveUrl(route.moduleUrl) : document.baseURI;
      const html = await (route.htmlContent ?? this.loadHtml(htmlUrl));
      const module = await (route.moduleObject ?? (typeof route.module === "function" && !route.module.prototype ? route.module() : this.loadModule(moduleUrl)));
      return {
        html,
        module,
        htmlUrl,
        moduleUrl
      };
    }
    loadHtml(url) {
      if (!this.htmlCache.has(url)) {
        this.htmlCache.set(
          url,
          fetch(resolveBrowserLoadUrl(url)).then(async (response) => {
            if (!response.ok) {
              throw createMissingPageError(url);
            }
            return response.text();
          }).catch((error) => {
            if (isMissingPageFetchError(error)) {
              throw createMissingPageError(url, error);
            }
            throw error;
          })
        );
      }
      return this.htmlCache.get(url);
    }
    loadModule(url) {
      if (!this.moduleCache.has(url)) {
        this.moduleCache.set(
          url,
          loadPageScript(url).then((definition) => normalizePageScript(definition)).catch((error) => {
            const message = String(error);
            if (message.includes("Failed to fetch dynamically imported module") || message.includes("Cannot find module") || message.includes("Importing a module script failed")) {
              reportRoseltResourceError({
                kind: "page",
                resourceType: "page module",
                title: "Missing Page Module",
                message: "Roselt.js could not load a referenced page script, so only the HTML was rendered.",
                requestedUrl: url,
                cause: error
              });
              return normalizePageScript(createEmptyPageScript());
            }
            throw error;
          })
        );
      }
      return this.moduleCache.get(url);
    }
    loadStylesheet(url, { optional = false } = {}) {
      const cacheKey = `${optional ? "optional" : "required"}:${url}`;
      if (!this.stylesheetCache.has(cacheKey)) {
        this.stylesheetCache.set(
          cacheKey,
          fetch(resolveBrowserLoadUrl(url)).then(async (response) => {
            if (!response.ok) {
              if (optional) {
                return null;
              }
              throw new Error(`Failed to load stylesheet: ${url}`);
            }
            return {
              href: url,
              cssText: await response.text()
            };
          }).catch((error) => {
            if (optional) {
              const message = String(error);
              if (error instanceof TypeError || message.includes("Failed to fetch") || message.includes("NetworkError")) {
                return null;
              }
            }
            throw error;
          })
        );
      }
      return this.stylesheetCache.get(cacheKey);
    }
    clear() {
      this.htmlCache.clear();
      this.moduleCache.clear();
      this.stylesheetCache.clear();
    }
    isMissingPageError(error) {
      return error?.code === "ROSELT_PAGE_NOT_FOUND";
    }
  };

  // src/seo/head-manager.js
  var managedSelector = "[data-navigate-managed]";
  function upsertMeta(name, content, attribute = "name") {
    if (!content) {
      const existing = document.head.querySelector(`meta[${attribute}="${name}"]${managedSelector}`);
      if (existing) {
        existing.remove();
      }
      return;
    }
    let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, name);
      document.head.appendChild(element);
    }
    element.setAttribute("content", content);
    element.setAttribute("data-navigate-managed", "true");
  }
  function upsertCanonical(href) {
    if (!href) {
      const existing = document.head.querySelector(`link[rel="canonical"]${managedSelector}`);
      if (existing) {
        existing.remove();
      }
      return;
    }
    let element = document.head.querySelector('link[rel="canonical"]');
    if (!element) {
      element = document.createElement("link");
      element.rel = "canonical";
      document.head.appendChild(element);
    }
    element.href = href;
    element.setAttribute("data-navigate-managed", "true");
  }
  function applyHead(route, pageModule, runtimeMeta, currentUrl) {
    const meta = {
      ...route.meta || {},
      ...pageModule.meta || {},
      ...runtimeMeta || {}
    };
    if (meta.title) {
      document.title = meta.title;
    }
    upsertMeta("description", meta.description);
    upsertMeta("og:title", meta.ogTitle ?? meta.title, "property");
    upsertMeta("og:description", meta.ogDescription ?? meta.description, "property");
    upsertMeta("twitter:title", meta.twitterTitle ?? meta.title);
    upsertMeta("twitter:description", meta.twitterDescription ?? meta.description);
    const canonical = meta.canonical ? new URL(meta.canonical, currentUrl).href : currentUrl.href;
    upsertCanonical(canonical);
  }

  // src/runtime/render-engine.js
  var NOT_FOUND_PAGE_ID = "404";
  function dedupeStylesheets(entries) {
    const seen = /* @__PURE__ */ new Set();
    return entries.filter((entry) => {
      if (!entry?.href || seen.has(entry.href)) {
        return false;
      }
      seen.add(entry.href);
      return true;
    });
  }
  function resolveDefinitions(definitions2 = {}, baseUrl = document.baseURI) {
    return Object.fromEntries(
      Object.entries(definitions2).map(([tagName, definition]) => [
        tagName,
        typeof definition === "string" ? resolveUrl(definition, baseUrl) : definition
      ])
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
      ...!hasInlineStyles ? [
        {
          href: createSiblingStylesheetUrl(pageHtmlUrl),
          optional: true
        }
      ] : [],
      ...(route.stylesheets || []).map((href) => ({
        href: resolveUrl(href, document.baseURI),
        optional: false
      })),
      ...(pageModule.stylesheets || []).map((href) => ({
        href: resolveUrl(href, pageModuleUrl),
        optional: false
      }))
    ]);
  }
  function normalizeRuntimeStylesheets(runtimeMeta, currentUrl) {
    return dedupeStylesheets(
      (runtimeMeta?.stylesheets || []).map((href) => ({
        href: resolveUrl(href, currentUrl.href),
        optional: false
      }))
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
      inlineStyles
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
      }
    };
  }
  function normalizeEventListenerOptions(options, signal) {
    if (typeof options === "boolean") {
      return {
        capture: options,
        signal
      };
    }
    if (!options) {
      return { signal };
    }
    if (options.signal && typeof AbortSignal?.any === "function") {
      return {
        ...options,
        signal: AbortSignal.any([options.signal, signal])
      };
    }
    if (options.signal) {
      return options;
    }
    return {
      ...options,
      signal
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
        normalizeEventListenerOptions(options, controller.signal)
      );
    };
    try {
      return {
        result: await callback(),
        cleanup() {
          controller.abort();
        }
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
      navigate: (target, parameters, navigationOptions) => app.navigate(target, parameters, navigationOptions),
      query: Object.fromEntries(currentUrl.searchParams.entries()),
      cleanup: (callback) => cleanupManager.add(callback)
    };
  }
  function createNotFoundRoute(options) {
    return {
      name: NOT_FOUND_PAGE_ID,
      query: NOT_FOUND_PAGE_ID,
      path: `/${NOT_FOUND_PAGE_ID}`,
      html: `${options.pagesDirectory}/${NOT_FOUND_PAGE_ID}.html`,
      module: `${options.pagesDirectory}/${NOT_FOUND_PAGE_ID}.js`
    };
  }
  function isNotFoundRoute(route) {
    return route?.name === NOT_FOUND_PAGE_ID || route?.query === NOT_FOUND_PAGE_ID;
  }
  var RenderEngine = class {
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
          pageUsesInlineStyles
        ).map((entry) => this.loader.loadStylesheet(entry.href, { optional: entry.optional }))
      );
      await this.cleanup();
      this.activeStyleElements = this.applyStyles(initialStylesheets, extractedPage.inlineStyles);
      this.app.pageRoot.setAttribute("data-roselt-page-source", page.htmlUrl);
      this.app.pageRoot.innerHTML = extractedPage.html;
      this.components.registerAll(resolveDefinitions(routeMatch.route.components, document.baseURI));
      this.components.registerAll(resolveDefinitions(page.module.components, page.moduleUrl));
      await this.components.ensureForRoot(
        this.app.pageRoot,
        (tagName) => this.app.resolveComponent(tagName)
      );
      await this.sections.hydrateRoot(this.app.pageRoot);
      setActivePageContext(pageContext);
      const loadFunction = page.module.load;
      let runtimeMeta = {};
      try {
        if (typeof loadFunction === "function") {
          const { result: mountResult, cleanup: cleanupListeners } = await capturePageEventListeners(
            () => loadFunction(pageContext)
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
          normalizeRuntimeStylesheets(runtimeMeta, currentUrl).map((entry) => this.loader.loadStylesheet(entry.href, { optional: entry.optional }))
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
            url: currentUrl
          }
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
        error
      );
      const details = {
        kind: "page",
        resourceType: "page file",
        title: "Missing Page File",
        message: "Roselt.js could not load the requested page HTML, so a developer error page was rendered instead.",
        reference: routeMatch.route?.name || routeMatch.route?.path || currentUrl.pathname,
        requestedUrl: error?.pageUrl || routeMatch.route?.html || "",
        source: currentUrl.href,
        cause: error
      };
      this.app.pageRoot.innerHTML = createRoseltErrorMarkup(details, { variant: "page" });
      try {
        lockRoseltOverlayScroll(document);
      } catch (_) {
      }
      const closeButton = this.app.pageRoot.querySelector(".roselt-runtime-error-close");
      if (closeButton instanceof HTMLButtonElement) {
        closeButton.addEventListener("click", () => {
          try {
            unlockRoseltOverlayScroll(document);
          } catch (_) {
          }
          this.app.pageRoot.innerHTML = "";
        });
      }
    }
  };

  // src/runtime/section-loader.js
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
  function escapeRegExp2(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function createCodeFrame2(source, lineNumber) {
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
        highlight: startLine + index === lineNumber
      }))
    };
  }
  function findIncludeMatch(source, includeNode, src) {
    const exactMarkup = includeNode?.outerHTML;
    if (exactMarkup) {
      const exactIndex = source.indexOf(exactMarkup);
      if (exactIndex >= 0) {
        return {
          index: exactIndex,
          text: exactMarkup
        };
      }
    }
    const sectionPattern = new RegExp(
      `<roselt\\b[^>]*\\bsection\\s*=\\s*(["'])${escapeRegExp2(src)}\\1[^>]*>(?:\\s*<\\/roselt>)?`,
      "i"
    );
    const match = sectionPattern.exec(source);
    if (!match) {
      return null;
    }
    return {
      index: match.index,
      text: match[0]
    };
  }
  function createSourceLocation2(url, source, match) {
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
      codeFrame: createCodeFrame2(source, line)
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
    return error instanceof TypeError || message.includes("Failed to fetch") || message.includes("NetworkError");
  }
  var SectionLoader = class {
    constructor(options = {}) {
      const { sectionsDirectory = "sections" } = options;
      this.sectionsDirectory = sectionsDirectory;
      this.sectionCache = /* @__PURE__ */ new Map();
      this.sourceCache = /* @__PURE__ */ new Map();
      this.stylesheetCache = /* @__PURE__ */ new Map();
      this.appliedStylesheets = /* @__PURE__ */ new Map();
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
        const sectionUrl = isShorthandSectionReference(src) ? resolveUrl(`${this.sectionsDirectory}/${src}.html`, document.baseURI) : resolveUrl(src, baseUrl);
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
            topFrame: includeLocation ? {
              functionName: "roselt[section]",
              url: includeLocation.url,
              line: includeLocation.line,
              column: includeLocation.column
            } : null,
            codeFrame: includeLocation?.codeFrame || null,
            stack: includeLocation ? "" : void 0,
            cause: error
          });
          const replacement = document.createRange().createContextualFragment(
            createRoseltErrorMarkup(details)
          );
          includeNode.replaceWith(replacement);
        }
      }
    }
    async loadSource(url) {
      if (!this.sourceCache.has(url)) {
        this.sourceCache.set(
          url,
          fetch(resolveBrowserLoadUrl(url)).then(async (response) => response.ok ? response.text() : null).catch(() => null)
        );
      }
      return this.sourceCache.get(url);
    }
    async resolveIncludeLocation(baseUrl, includeNode, src) {
      const source = await this.loadSource(baseUrl);
      if (!source) {
        return null;
      }
      return createSourceLocation2(baseUrl, source, findIncludeMatch(source, includeNode, src));
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
          fetch(resolveBrowserLoadUrl(url)).then(async (response) => {
            if (!response.ok) {
              throw createMissingSectionError(url, reference);
            }
            return response.text();
          }).catch((error) => {
            if (isMissingSectionFetchError(error)) {
              throw createMissingSectionError(url, reference, error);
            }
            throw error;
          })
        );
      }
      return this.sectionCache.get(url);
    }
    loadStylesheet(url, { optional = false } = {}) {
      const cacheKey = `${optional ? "optional" : "required"}:${url}`;
      if (!this.stylesheetCache.has(cacheKey)) {
        this.stylesheetCache.set(
          cacheKey,
          fetch(resolveBrowserLoadUrl(url)).then(async (response) => {
            if (!response.ok) {
              if (optional) {
                return null;
              }
              throw new Error(`Failed to load stylesheet: ${url}`);
            }
            return {
              href: url,
              cssText: await response.text()
            };
          }).catch((error) => {
            if (optional) {
              const message = String(error);
              if (error instanceof TypeError || message.includes("Failed to fetch") || message.includes("NetworkError")) {
                return null;
              }
            }
            throw error;
          })
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
      const sectionUrls = /* @__PURE__ */ new Set();
      if (root instanceof Element && root.hasAttribute("data-roselt-section-source")) {
        sectionUrls.add(root.getAttribute("data-roselt-section-source"));
      }
      if (root && typeof root.querySelectorAll === "function") {
        for (const element of root.querySelectorAll("[data-roselt-section-source]")) {
          sectionUrls.add(element.getAttribute("data-roselt-section-source"));
        }
      }
      await Promise.all(
        Array.from(sectionUrls).filter(Boolean).map((sectionUrl) => this.ensureSectionAssets(sectionUrl))
      );
    }
  };

  // src/Roselt.js
  var DEFAULT_PAGE_ROOT_SELECTOR = "roselt[page][navigate]";
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
      (styleElement) => styleElement.getAttribute("data-roselt-entry-style") === assetUrl
    );
  }
  var Roselt = class _Roselt {
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
        defaultPage
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
        defaultPage: resolvedDefaultPage
      };
      if (!this.pageRoot) {
        throw new Error("Roselt.js could not find a roselt[page][navigate] page root.");
      }
      this.loader = new PageLoader();
      this.sections = new SectionLoader({
        sectionsDirectory: this.options.sectionsDirectory
      });
      this.components = globalComponentRegistry;
      this.components.registerAll(components);
      this.renderer = new RenderEngine(this, this.loader, this.sections, this.components);
      this.router = new NavigationRouter(this);
      this.started = false;
      this.handleWindowError = this.handleWindowError.bind(this);
      this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
      this.href = createHrefBuilder(this.routes, this.options);
    }
    handleWindowError(event) {
      if (!event?.error) {
        return;
      }
      reportRoseltRuntimeError(event.error, {
        filename: event.filename,
        description: event.message || "An uncaught runtime error happened while Roselt.js was running the current page."
      });
    }
    handleUnhandledRejection(event) {
      reportRoseltRuntimeError(event?.reason, {
        description: "An unhandled promise rejection happened while Roselt.js was running the current page."
      });
    }
    async ensureEntryAssets() {
      const stylesheetUrl = createEntryAssetUrl(".css");
      if (stylesheetUrl && !hasResolvedAssetReference('link[rel="stylesheet"][href]', "href", stylesheetUrl) && !hasAppliedEntryStylesheet(stylesheetUrl)) {
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
          (tagName) => this.resolveComponent(tagName)
        );
        await this.sections.hydrateRoot(document.body);
        this.router.start();
        window.addEventListener("error", this.handleWindowError);
        window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
        setActiveRoseltApp(this);
        this.started = true;
        return this.router.bootstrap();
      });
    }
    stop() {
      this.router.stop();
      window.removeEventListener("error", this.handleWindowError);
      window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
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
      const url = target instanceof URL ? target : new URL(this.href(target, parameters, new URL(window.location.href)));
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
      const app = new _Roselt(options);
      await app.start();
      return app;
    }
  };
  var Roselt_default = Roselt;

  // src/index.js
  async function start(options) {
    return Roselt_default.start(options);
  }

  // src/browser-global.js
  Object.assign(globalThis.Roselt ?? {}, {
    Roselt: Roselt_default,
    start,
    ComponentRegistry,
    defineComponent,
    globalComponentRegistry,
    lazyComponent
  });
})();
