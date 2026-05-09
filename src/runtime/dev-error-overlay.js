const STYLE_ID = "roselt-runtime-error-style";
const PANEL_ID = "roselt-runtime-error-panel";

const errorEntries = [];
const errorKeys = new Set();
const pendingCodeFrames = new Map();
let dismissed = false;
let _overlayActive = false;
let _prevHtmlOverflow = null;
let _prevBodyOverflow = null;

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
  return String(value || "")
    .replace(/^async\s+/, "")
    .trim();
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
        column: Number(chromiumMatch[4]),
      });
      continue;
    }

    const firefoxMatch = line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);

    if (firefoxMatch) {
      frames.push({
        functionName: trimFunctionName(firefoxMatch[1]),
        url: firefoxMatch[2],
        line: Number(firefoxMatch[3]),
        column: Number(firefoxMatch[4]),
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
      highlight: startLine + index === lineNumber,
    })),
  };
}

function renderCodeFrameMarkup(codeFrame) {
  if (!codeFrame?.lines?.length) {
    return "";
  }

  return `
    <section class="roselt-runtime-error-codeframe">
      <h4>Source</h4>
      <pre>${codeFrame.lines
        .map(
          (line) =>
            `<div class="roselt-runtime-error-codeframe-line${line.highlight ? " is-highlighted" : ""}"><span class="roselt-runtime-error-gutter">${line.lineNumber}</span><span class="roselt-runtime-error-code">${escapeHtml(line.text || " ")}</span></div>`,
        )
        .join("")}</pre>
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
      fetch(details.topFrame.url)
        .then((response) => (response.ok ? response.text() : null))
        .then((source) => extractCodeFrame(source, details.topFrame.line))
        .catch(() => null),
    );
  }

  const codeFrame = await pendingCodeFrames.get(cacheKey);

  if (codeFrame) {
    details.codeFrame = codeFrame;
    renderPanel();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatLabel(value) {
  return String(value || "resource")
    .replaceAll(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function createErrorKey(details) {
  return [
    details.kind,
    details.resourceType,
    details.reference,
    details.requestedUrl,
    details.source,
    details.message,
  ]
    .filter(Boolean)
    .join("|");
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
    codeFrame: details.codeFrame || null,
  };
}

function createMetadataRows(details) {
  return [
    details.errorName ? ["Type", details.errorName] : null,
    details.topFrame ? ["Location", formatStackFrame(details.topFrame)] : null,
    details.reference ? ["Reference", details.reference] : null,
    details.source ? ["Referenced From", details.source] : null,
    details.requestedUrl ? ["Resolved URL", details.requestedUrl] : null,
    details.cause?.message ? ["Cause", details.cause.message] : null,
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
  const metadata = createMetadataRows(details)
    .map(
      ([label, value]) =>
        `<div class="roselt-runtime-error-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");

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
      description: "Roselt.js caught an uncaught error and kept the current app visible so you can inspect the failure.",
    };
  }

  return {
    heading: "Roselt.js Missing Files",
    description: "Rendering continued where possible so you can inspect the rest of the app.",
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

export function ensureRoseltErrorStyles(documentRef = document) {
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
        <button class="roselt-runtime-error-close" type="button" aria-label="Close Roselt.js error panel">×</button>
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
      // best-effort restore
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
    // best-effort lock/unlock
  }
}

export function lockRoseltOverlayScroll(documentRef = document) {
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
    // ignore
  }
}

export function unlockRoseltOverlayScroll(documentRef = document) {
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
    // ignore
  }

  _overlayActive = false;
  _prevHtmlOverflow = null;
  _prevBodyOverflow = null;
}

export function reportRoseltResourceError(details) {
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

export function reportRoseltRuntimeError(error, details = {}) {
  const cause = error instanceof Error ? error : new Error(String(error || "Unknown runtime error"));
  const normalized = normalizeDetails({
    kind: "runtime",
    resourceType: "runtime error",
    title: `${readErrorName(cause)}: ${readErrorMessage({ message: details.message, cause })}`,
    message: details.description || "An uncaught runtime error happened while Roselt.js was running the current page.",
    reference: details.reference || "",
    requestedUrl: details.requestedUrl || details.filename || "",
    source: details.source || window.location.href,
    cause,
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

export function createRoseltErrorMarkup(details, { variant = "inline" } = {}) {
  const normalized = normalizeDetails(details);
  const metadata = createMetadataRows(normalized)
    .map(
      ([label, value]) =>
        `<div class="roselt-runtime-error-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");

  return `
    <section class="roselt-runtime-error-placeholder" data-roselt-error-variant="${escapeHtml(variant)}">
      ${variant === "page" ? '<button class="roselt-runtime-error-close" type="button" aria-label="Close error page">×</button>' : ""}
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