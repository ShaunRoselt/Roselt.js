function updateMode(pageId) {
  const isDocsPage = pageId.startsWith("docs/");

  document.body.classList.toggle("site-mode-docs", isDocsPage);
  document.body.dataset.pageId = globalThis.RoseltDocs.pageIdDataValue(pageId);

  if (!isDocsPage) {
    document.body.classList.remove("docs-sidebar-open");
  }
}

function syncDocsSidebar(app, pageId) {
  const siteMain = document.querySelector(".site-main");
  const pageColumn = siteMain?.querySelector(".site-page-column");
  const existingSidebar = siteMain?.querySelector(".docs-sidebar");
  const pageRootSidebar = app?.pageRoot?.querySelector(".docs-sidebar");

  if (!(siteMain instanceof HTMLElement) || !(pageColumn instanceof HTMLElement)) {
    return;
  }

  if (!pageId.startsWith("docs/")) {
    existingSidebar?.remove();
    return;
  }

  if (pageRootSidebar instanceof HTMLElement) {
    existingSidebar?.remove();
    siteMain.insertBefore(pageRootSidebar, pageColumn);
    return;
  }

  if (!existingSidebar) {
    throw new Error("Docs pages must include <roselt section=\"docs-sidebar\"></roselt>.");
  }
}

function syncChrome(app) {
  const pageId = globalThis.RoseltDocs.currentPageId();

  updateMode(pageId);
  syncDocsSidebar(app, pageId);
}

function isSidebarOnlyPageRootMutation(records) {
  return records.length > 0 && records.every((record) => {
    const changedNodes = [...record.addedNodes, ...record.removedNodes]
      .filter((node) => node instanceof Element);

    return changedNodes.length > 0
      && changedNodes.every((node) => node.classList.contains("docs-sidebar"));
  });
}

function initializeSiteChrome(app) {
  if (globalThis.__roseltDocsChromeInitialized) {
    return;
  }

  globalThis.__roseltDocsChromeInitialized = true;

  let refreshScheduled = false;
  const pageRoot = app?.pageRoot ?? document.querySelector("roselt[page][navigate]");

  const refreshChrome = () => {
    syncChrome(app);
    globalThis.hljs?.highlightAll();
  };

  const scheduleRefreshChrome = () => {
    if (refreshScheduled) {
      return;
    }

    refreshScheduled = true;

    requestAnimationFrame(() => {
      refreshScheduled = false;
      refreshChrome();
    });
  };

  if (pageRoot instanceof Element) {
    const pageRootObserver = new MutationObserver((records) => {
      if (isSidebarOnlyPageRootMutation(records)) {
        return;
      }

      scheduleRefreshChrome();
    });

    pageRootObserver.observe(pageRoot, { childList: true });
  }

  refreshChrome();
}

globalThis.initializeSiteChrome = initializeSiteChrome;
