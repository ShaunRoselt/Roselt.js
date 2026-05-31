import { resolveBrowserLoadUrl } from "../utils/resolve-url.js";

const sourceCache = new Map();
const executionCache = new Map();
const executionUrlStack = [];

function isMissingScriptError(error) {
  const message = String(error);

  return (
    error instanceof TypeError ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError")
  );
}

export function sourceUsesModuleSyntax(source) {
  return /^\s*(import|export)\b/m.test(source);
}

export async function readClassicScriptSource(url, { optional = false } = {}) {
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
      })
        .catch((error) => {
          if (optional && isMissingScriptError(error)) {
            return null;
          }

          throw error;
        }),
    );
  }

  return sourceCache.get(url);
}

export function executeClassicScript(source, url) {
  const script = document.createElement("script");
  script.textContent = `(function () {\n${source}\n}).call(globalThis);\n//# sourceURL=${url}`;

  executionUrlStack.push(url);

  try {
    document.head.append(script);
  } finally {
    script.remove();
    executionUrlStack.pop();
  }
}

export function getActiveClassicScriptUrl() {
  return executionUrlStack[executionUrlStack.length - 1] || "";
}

export async function loadClassicScript(url, { optional = false } = {}) {
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
            `Roselt.js no longer supports ES module page or component scripts. Convert ${url} to a classic script.`,
          );
        }

        executeClassicScript(source, url);
        return source;
      })(),
    );
  }

  return executionCache.get(cacheKey);
}