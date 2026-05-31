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
    description: "Understand the default pages and components layout.",
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
    title: "Shell components",
    group: "Core concepts",
    description: "Keep shared UI mounted with reusable components that live outside routed pages.",
  },
  {
    pageId: "docs/components",
    title: "Components",
    group: "Core concepts",
    description: "Author components from files in the components directory.",
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
    const isDocsIndex = isPrimaryDocsLink && pageId.startsWith("docs/") && !hasPrimaryNavExactMatch;
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
  setExpandedState("[data-toggle-docs-sidebar]", document.body.classList.contains("docs-sidebar-open"));
}

function searchUrl(pageId) {
  return `?page=${pageId}`;
}

function searchTerms(value) {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
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

Roselt.defineComponent(function () {
  this.shadow = false;

  this.render = () => `
    <style>
      .site-header {
        position: sticky;
        top: 0;
        z-index: 50;
        width: 100%;
        border-bottom: 1px solid var(--header-border);
        background: var(--header-bg);
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
      }

      .site-header__inner {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 1.5rem;
        width: var(--site-width);
        margin: 0 auto;
        min-height: 72px;
      }

      .site-header__brand {
        display: inline-flex;
        align-items: center;
        gap: 0.85rem;
        min-width: 0;
      }

      .site-header__brand-copy {
        display: grid;
        gap: 0.05rem;
      }

      .site-header__mark {
        width: 2.65rem;
        height: 2.65rem;
        border-radius: 18px;
        box-shadow: 0 18px 40px rgba(92, 116, 145, 0.18);
        object-fit: cover;
      }

      .site-header__eyebrow {
        color: var(--text-tertiary);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.04em;
      }

      .site-header__title {
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .site-header__controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        min-width: 0;
      }

      .site-header__search {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 0.7rem;
        min-width: 13.75rem;
        height: 2.75rem;
        padding: 0 0.9rem 0 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        background: var(--bg-elevated);
        box-shadow: var(--shadow-sm);
        color: var(--text-secondary);
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
      }

      .site-header__search:hover,
      .site-header__search:focus-visible {
        border-color: var(--border-strong);
        background: var(--bg);
        transform: translateY(-1px);
      }

      .site-header__search svg {
        flex-shrink: 0;
      }

      .site-header__search-label {
        font-size: 0.95rem;
        font-weight: 500;
        white-space: nowrap;
      }

      .site-header__search-shortcut {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }

      .site-header__search-shortcut kbd,
      .site-search__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.65rem;
        height: 1.65rem;
        padding: 0 0.45rem;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: var(--bg);
        color: var(--text-tertiary);
        box-shadow: inset 0 -1px 0 rgba(15, 23, 42, 0.06);
        font-family: "IBM Plex Mono", "SF Mono", monospace;
        font-size: 0.72rem;
        font-weight: 500;
      }

      .site-search {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: none;
      }

      .site-search-open .site-search {
        display: block;
      }

      .site-search__backdrop {
        appearance: none;
        position: absolute;
        inset: 0;
        border: 0;
        background: rgba(15, 23, 42, 0.46);
        cursor: pointer;
      }

      .site-search__dialog {
        position: relative;
        width: min(42rem, calc(100vw - 2rem));
        margin: 5.5rem auto 0;
        border: 1px solid var(--border);
        border-radius: 28px;
        background: linear-gradient(180deg, var(--bg-elevated), var(--bg));
        box-shadow: var(--shadow-lg);
        overflow: hidden;
      }

      .site-search__top {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 1rem 1.1rem;
        border-bottom: 1px solid var(--border);
        background: var(--bg-soft);
      }

      .site-search__icon {
        color: var(--text-tertiary);
        flex-shrink: 0;
      }

      .site-search__input {
        flex: 1;
        min-width: 0;
        border: 0;
        background: transparent;
        color: var(--text);
        font-size: 1rem;
        outline: 0;
      }

      .site-search__input::placeholder {
        color: var(--text-tertiary);
      }

      .site-search__close {
        appearance: none;
        cursor: pointer;
      }

      .site-search__body {
        display: grid;
        gap: 0.65rem;
        padding: 0.85rem;
      }

      .site-search__label {
        padding: 0 0.35rem;
        color: var(--text-tertiary);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .site-search__results {
        display: grid;
        gap: 0.35rem;
        max-height: min(60vh, 26rem);
        overflow-y: auto;
      }

      .site-search__result {
        display: grid;
        gap: 0.18rem;
        padding: 0.85rem 0.95rem;
        border: 1px solid transparent;
        border-radius: 18px;
        transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      }

      .site-search__result:hover,
      .site-search__result:focus-visible,
      .site-search__result[aria-current="page"] {
        background: var(--accent-soft);
        border-color: var(--border);
        transform: translateY(-1px);
      }

      .site-search__result-meta {
        color: var(--accent-hover);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .site-search__result-title {
        color: var(--text);
        font-size: 1rem;
        font-weight: 600;
      }

      .site-search__result-description {
        color: var(--text-secondary);
        font-size: 0.9rem;
        line-height: 1.5;
      }

      .site-search__empty {
        margin: 0;
        padding: 0.4rem 0.5rem 0.75rem;
        color: var(--text-tertiary);
        font-size: 0.92rem;
      }

      .site-header__nav {
        display: flex;
        align-items: center;
        gap: 0.2rem;
        margin-left: auto;
      }

      .site-header__nav a {
        padding: 0.55rem 0.85rem;
        border-radius: 999px;
        color: var(--text-secondary);
        font-size: 0.92rem;
        font-weight: 600;
        transition: color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
      }

      .site-header__nav a:hover,
      .site-header__nav a:focus-visible,
      .site-header__nav a[aria-current="page"] {
        color: var(--text);
        background: var(--accent-soft);
      }

      .site-header__icon-btn,
      .site-header__sidebar-toggle,
      .site-header__menu-toggle {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 2.75rem;
        padding: 0 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        background: var(--bg-elevated);
        color: var(--text-secondary);
        cursor: pointer;
        box-shadow: var(--shadow-sm);
        transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .site-header__icon-btn {
        width: 2.75rem;
        padding: 0;
      }

      .site-header__icon-btn:hover,
      .site-header__sidebar-toggle:hover,
      .site-header__menu-toggle:hover {
        color: var(--text);
        background: var(--bg);
        border-color: var(--border-strong);
        transform: translateY(-1px);
      }

      .site-header__icon-btn svg {
        flex-shrink: 0;
      }

      .site-header__sidebar-toggle,
      .site-header__menu-toggle {
        display: none;
      }

      @media (max-width: 960px) {
        .site-header__search {
          min-width: 11rem;
        }
      }

      @media (max-width: 768px) {
        .site-header__inner {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.85rem;
        }

        .site-header__menu-toggle,
        .site-mode-docs .site-header__sidebar-toggle {
          display: inline-flex;
        }

        .site-header__search {
          min-width: 0;
          width: 2.75rem;
          padding: 0;
          justify-content: center;
        }

        .site-header__search-shortcut {
          display: none;
        }

        .site-header__nav {
          position: absolute;
          left: 1rem;
          right: 1rem;
          top: calc(100% + 0.75rem);
          display: none;
          flex-direction: column;
          align-items: stretch;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 22px;
          background: var(--bg-elevated);
          box-shadow: var(--shadow-lg);
        }

        .site-nav-open .site-header__nav {
          display: flex;
        }

        .site-header__nav a {
          padding: 0.8rem 0.95rem;
          border-radius: 16px;
        }

        .site-header__search-label {
          display: none;
        }
      }
    </style>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-header__brand" href="?page=home" aria-label="Roselt.js home">
          <img class="site-header__mark" src="assets/roselt-logo.svg" alt="">

          <span class="site-header__brand-copy">
            <span class="site-header__eyebrow">File-based web UI</span>
            <span class="site-header__title">Roselt.js</span>
          </span>
        </a>

        <div class="site-header__controls">
          <button
            class="site-header__sidebar-toggle"
            type="button"
            data-toggle-docs-sidebar
            aria-expanded="false"
            aria-controls="docs-sidebar"
          >
            Docs
          </button>

          <button
            class="site-header__menu-toggle"
            type="button"
            data-toggle-site-nav
            aria-expanded="false"
            aria-controls="site-primary-nav"
          >
            Menu
          </button>

          <button
            class="site-header__search"
            type="button"
            data-open-search
            aria-label="Search documentation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <span class="site-header__search-label">Search</span>
            <span class="site-header__search-shortcut" aria-hidden="true">
              <kbd>Ctrl</kbd>
              <kbd>K</kbd>
            </span>
          </button>

          <nav class="site-header__nav" id="site-primary-nav" aria-label="Primary">
            <a href="?page=home">Home</a>
            <a href="?page=docs/getting-started">Docs</a>
            <a href="?page=blog">Blog</a>
            <a href="https://github.com/ShaunRoselt/Roselt.js" target="_blank" rel="noreferrer">GitHub</a>
          </nav>

          <button
            class="site-header__icon-btn"
            type="button"
            data-toggle-theme
            aria-label="Toggle dark mode"
          >
            <svg class="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg class="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
      </div>

      <div class="site-search" data-search-root aria-hidden="true">
        <button class="site-search__backdrop" type="button" data-close-search tabindex="-1" aria-label="Close search"></button>

        <div class="site-search__dialog" role="dialog" aria-modal="true" aria-labelledby="site-search-title">
          <div class="site-search__top">
            <svg class="site-search__icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <input
              class="site-search__input"
              type="search"
              placeholder="Search docs and pages"
              data-search-input
              aria-label="Search docs and pages"
            >
            <button class="site-search__close" type="button" data-close-search aria-label="Close search">Esc</button>
          </div>

          <div class="site-search__body">
            <div class="site-search__label" id="site-search-title">Jump to a page</div>
            <div class="site-search__results" data-search-results></div>
            <p class="site-search__empty" data-search-empty hidden>No matching pages.</p>
          </div>
        </div>
      </div>
    </header>
  `;

  this.connected = function () {
    initializeSiteHeader();
  };
});