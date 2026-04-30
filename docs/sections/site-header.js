const { currentPageId, normalizePageId } = globalThis.RoseltDocs;

const SEARCH_ITEMS = [
  {
    pageId: "home",
    title: "Home",
    group: "Overview",
    description: "Landing page for Roselt.js and the main framework overview.",
  },
  {
    pageId: "docs/getting-started",
    title: "Getting started",
    group: "Start",
    description: "Create a Roselt.js app with a single entry file and pages folder.",
  },
  {
    pageId: "docs/installation",
    title: "Installation",
    group: "Start",
    description: "Install Roselt.js and choose a setup that fits your app.",
  },
  {
    pageId: "docs/project-structure",
    title: "Project structure",
    group: "Start",
    description: "Understand the default pages, sections, and components layout.",
  },
  {
    pageId: "docs/routing",
    title: "Routing and navigation",
    group: "Core concepts",
    description: "Learn query routing, pathname routing, explicit routes, and page resolution.",
  },
  {
    pageId: "docs/pages",
    title: "Pages",
    group: "Core concepts",
    description: "Author routed pages and use the Roselt.Page runtime helpers.",
  },
  {
    pageId: "docs/sections",
    title: "Sections",
    group: "Core concepts",
    description: "Keep shared UI mounted with shell-level section files.",
  },
  {
    pageId: "docs/components",
    title: "Components",
    group: "Core concepts",
    description: "Register and load components from the components directory.",
  },
  {
    pageId: "docs/metadata-seo",
    title: "Metadata and SEO",
    group: "Reference",
    description: "Set page titles, descriptions, and other document metadata.",
  },
  {
    pageId: "docs/deployment",
    title: "Deployment",
    group: "Reference",
    description: "Ship Roselt.js apps to GitHub Pages and other static hosts.",
  },
  {
    pageId: "docs/api-reference",
    title: "API reference",
    group: "Reference",
    description: "Review the exported Roselt.js API and runtime behavior.",
  },
  {
    pageId: "docs/faq",
    title: "FAQ",
    group: "Reference",
    description: "Common questions about routing, hosting, and app structure.",
  },
];

function pageIdFromLink(link) {
  const href = link.getAttribute("href");

  if (!href) {
    return null;
  }

  const url = new URL(href, window.location.href);
  return normalizePageId(url.searchParams.get("page"));
}

function setExpandedState(selector, isExpanded) {
  const button = document.querySelector(selector);

  if (button instanceof HTMLButtonElement) {
    button.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  }
}

function updateActiveLinks(pageId = currentPageId()) {
  const routeLinks = Array.from(document.querySelectorAll("a[href*='?page=']"));
  const primaryNavLinks = routeLinks.filter((link) => link.closest(".site-header__nav"));
  const hasPrimaryNavExactMatch = primaryNavLinks.some((link) => pageIdFromLink(link) === pageId);

  for (const link of routeLinks) {
    const targetPageId = pageIdFromLink(link);
    const isPrimaryDocsLink = link.closest(".site-header__nav") && targetPageId === "docs/getting-started";
    const isDocsIndex =
      isPrimaryDocsLink &&
      pageId.startsWith("docs/") &&
      !hasPrimaryNavExactMatch;
    const isActive = targetPageId === pageId || isDocsIndex;

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function syncHeaderState() {
  updateActiveLinks(currentPageId());
  setExpandedState("[data-toggle-site-nav]", document.body.classList.contains("site-nav-open"));
  setExpandedState(
    "[data-toggle-docs-sidebar]",
    document.body.classList.contains("docs-sidebar-open"),
  );
}

function searchUrl(pageId) {
  return `?page=${pageId}`;
}

function searchTerms(value) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function searchResults(value) {
  const terms = searchTerms(value);

  if (terms.length === 0) {
    return SEARCH_ITEMS;
  }

  return SEARCH_ITEMS.filter((item) => {
    const haystack = `${item.title} ${item.group} ${item.description}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

function renderSearchResults(value = "") {
  const resultsContainer = document.querySelector("[data-search-results]");
  const emptyState = document.querySelector("[data-search-empty]");

  if (!(resultsContainer instanceof HTMLElement) || !(emptyState instanceof HTMLElement)) {
    return;
  }

  const pageId = currentPageId();
  const matches = searchResults(value);

  resultsContainer.replaceChildren();

  for (const item of matches) {
    const link = document.createElement("a");
    link.className = "site-search__result";
    link.href = searchUrl(item.pageId);

    if (item.pageId === pageId) {
      link.setAttribute("aria-current", "page");
    }

    const meta = document.createElement("span");
    meta.className = "site-search__result-meta";
    meta.textContent = item.group;

    const title = document.createElement("strong");
    title.className = "site-search__result-title";
    title.textContent = item.title;

    const description = document.createElement("span");
    description.className = "site-search__result-description";
    description.textContent = item.description;

    link.append(meta, title, description);
    resultsContainer.append(link);
  }

  emptyState.hidden = matches.length > 0;
}

function openSearch() {
  const root = document.querySelector("[data-search-root]");
  const input = document.querySelector("[data-search-input]");

  if (!(root instanceof HTMLElement) || !(input instanceof HTMLInputElement)) {
    return;
  }

  document.body.classList.add("site-search-open");
  root.setAttribute("aria-hidden", "false");
  input.value = "";
  renderSearchResults("");
  requestAnimationFrame(() => input.focus());
}

function closeSearch() {
  const root = document.querySelector("[data-search-root]");
  const input = document.querySelector("[data-search-input]");

  if (root instanceof HTMLElement && root.contains(document.activeElement)) {
    document.activeElement?.blur?.();
  }

  document.body.classList.remove("site-search-open");

  if (root instanceof HTMLElement) {
    root.setAttribute("aria-hidden", "true");
  }

  if (input instanceof HTMLInputElement) {
    input.value = "";
  }
}

function closeHeaderOverlays() {
  closeSearch();
  document.body.classList.remove("site-nav-open", "docs-sidebar-open");
  syncHeaderState();
}

function initializeSearch() {
  const root = document.querySelector("[data-search-root]");
  const dialog = document.querySelector(".site-search__dialog");
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");

  for (const button of document.querySelectorAll("[data-open-search]")) {
    button.addEventListener("click", openSearch);
  }

  for (const button of document.querySelectorAll("[data-close-search]")) {
    button.addEventListener("click", closeSearch);
  }

  if (root instanceof HTMLElement && dialog instanceof HTMLElement) {
    root.addEventListener("click", (event) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!document.body.classList.contains("site-search-open")) {
        return;
      }

      if (!dialog.contains(event.target)) {
        closeSearch();
      }
    });
  }

  if (input instanceof HTMLInputElement) {
    input.addEventListener("input", () => {
      renderSearchResults(input.value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      const firstResult = document.querySelector(".site-search__result");

      if (!(firstResult instanceof HTMLAnchorElement)) {
        return;
      }

      event.preventDefault();
      closeSearch();
      firstResult.click();
    });
  }

  if (results instanceof HTMLElement) {
    results.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      if (event.target.closest("a.site-search__result")) {
        closeSearch();
      }
    });
  }

  renderSearchResults("");
}

function registerToggle(buttonSelector, bodyClass) {
  const button = document.querySelector(buttonSelector);

  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    const shouldOpen = !document.body.classList.contains(bodyClass);

    document.body.classList.toggle(bodyClass, shouldOpen);
    syncHeaderState();
  });
}

function initializeTheme() {
  const button = document.querySelector("[data-toggle-theme]");

  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("roselt-theme", next);
  });
}

function initializeSiteHeader() {
  if (globalThis.__roseltSiteHeaderInitialized) {
    syncHeaderState();
    renderSearchResults(document.querySelector("[data-search-input]")?.value || "");
    return;
  }

  globalThis.__roseltSiteHeaderInitialized = true;

  initializeTheme();
  initializeSearch();
  registerToggle("[data-toggle-site-nav]", "site-nav-open");
  registerToggle("[data-toggle-docs-sidebar]", "docs-sidebar-open");

  const bodyObserver = new MutationObserver(() => {
    syncHeaderState();
  });

  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
      return;
    }

    if (event.key === "Escape") {
      closeHeaderOverlays();
    }
  });

  navigation?.addEventListener("navigatesuccess", () => {
    closeHeaderOverlays();
    renderSearchResults(document.querySelector("[data-search-input]")?.value || "");
  });

  navigation?.addEventListener("currententrychange", () => {
    syncHeaderState();
    renderSearchResults(document.querySelector("[data-search-input]")?.value || "");
  });

  syncHeaderState();
  renderSearchResults("");
}

initializeSiteHeader();