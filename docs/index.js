const RoseltDocsShared = globalThis.RoseltDocs || (globalThis.RoseltDocs = {});

RoseltDocsShared.normalizePageId = function normalizePageId(value) {
  if (!value) {
    return "home";
  }

  return value.replace(/^\/+/, "").replace(/\/+$/, "") || "home";
};

RoseltDocsShared.currentPageId = function currentPageId(url = new URL(window.location.href)) {
  return RoseltDocsShared.normalizePageId(url.searchParams.get("page"));
};

RoseltDocsShared.pageIdDataValue = function pageIdDataValue(pageId) {
  return pageId.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
};

function updateMode(pageId) {
  const isDocsPage = pageId.startsWith("docs/");

  document.body.classList.toggle("site-mode-docs", isDocsPage);
  document.body.dataset.pageId = globalThis.RoseltDocs.pageIdDataValue(pageId);

  if (!isDocsPage) {
    document.body.classList.remove("docs-sidebar-open");
  }
}

function resolvePageRoot(app) {
  return app?.pageRoot ?? app?.outlet ?? document.querySelector("roselt[page][navigate]");
}

function syncDocsSidebar(app, pageId) {
  const siteMain = document.querySelector(".site-main");
  const pageColumn = siteMain?.querySelector(".site-page-column");
  const existingSidebar = siteMain?.querySelector("docs-sidebar");
  const pageRootSidebar = resolvePageRoot(app)?.querySelector("docs-sidebar");

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
    throw new Error("Docs pages must include <docs-sidebar></docs-sidebar>.");
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
      && changedNodes.every((node) => node.localName === "docs-sidebar");
  });
}

function initializeSiteChrome(app) {
  if (globalThis.__roseltDocsChromeInitialized) {
    return;
  }

  globalThis.__roseltDocsChromeInitialized = true;

  let refreshScheduled = false;
  const pageRoot = resolvePageRoot(app);

  const refreshChrome = () => {
    syncChrome(app);
    globalThis.hljs?.highlightAll();
    // ensure code copy buttons are present after highlighting
    try {
      RoseltDocsShared.addCodeCopyButtons?.();
    } catch (e) {
      // ignore errors here — don't break chrome refresh
      console.error(e);
    }
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

// Inject a small copy-to-clipboard button into code blocks and file trees.
RoseltDocsShared.addCodeCopyButtons = function addCodeCopyButtons() {
  const blocks = document.querySelectorAll("pre.code-block, pre.file-tree");

  blocks.forEach((pre) => {
    if (pre.dataset.copyInit === "1") return;
    pre.dataset.copyInit = "1";

    const codeEl = pre.querySelector('code') || pre;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-button';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></svg><span class="copy-label">Copy</span>';

    pre.appendChild(btn);

    const label = btn.querySelector('.copy-label');

    const setCopied = () => {
      btn.classList.add('copied');
      label.textContent = 'Copied';
      setTimeout(() => {
        btn.classList.remove('copied');
        label.textContent = 'Copy';
      }, 1400);
    };

    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const text = (codeEl && codeEl.innerText) || pre.innerText || '';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setCopied();
      } catch (err) {
        console.error('Copy failed', err);
        label.textContent = 'Error';
        setTimeout(() => (label.textContent = 'Copy'), 1400);
      }
    });

    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        btn.click();
      }
    });
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