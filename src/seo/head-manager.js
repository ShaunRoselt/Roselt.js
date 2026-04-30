const managedSelector = "[data-navigate-managed]";

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

export function applyHead(route, pageModule, runtimeMeta, currentUrl) {
  const meta = {
    ...(route.meta || {}),
    ...(pageModule.meta || {}),
    ...(runtimeMeta || {}),
  };

  if (meta.title) {
    document.title = meta.title;
  }

  upsertMeta("description", meta.description);
  upsertMeta("og:title", meta.ogTitle ?? meta.title, "property");
  upsertMeta("og:description", meta.ogDescription ?? meta.description, "property");
  upsertMeta("twitter:title", meta.twitterTitle ?? meta.title);
  upsertMeta("twitter:description", meta.twitterDescription ?? meta.description);

  const canonical = meta.canonical
    ? new URL(meta.canonical, currentUrl).href
    : currentUrl.href;

  upsertCanonical(canonical);
}