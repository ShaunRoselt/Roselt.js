Roselt.defineComponent(function () {
  this.shadow = false;

  this.render = () => `
    <style>
      .docs-sidebar {
        display: none;
      }

      .site-mode-docs .docs-sidebar {
        display: block;
      }

      .docs-sidebar__inner {
        position: sticky;
        top: calc(72px + 1.25rem);
        display: grid;
        gap: 1.15rem;
        max-height: calc(100vh - 72px - 1.5rem);
        overflow-y: auto;
        padding-right: 0.4rem;
      }

      .docs-sidebar__header {
        display: grid;
        gap: 0.45rem;
        padding: 1rem 1rem 1.1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: linear-gradient(180deg, var(--bg-elevated), var(--sidebar-bg));
        box-shadow: var(--shadow-sm);
      }

      .docs-sidebar__kicker {
        color: var(--accent);
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .docs-sidebar__title {
        font-size: 1rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .docs-sidebar__body {
        color: var(--text-tertiary);
        font-size: 0.88rem;
        line-height: 1.55;
      }

      .docs-sidebar__close {
        appearance: none;
        display: none;
        align-items: center;
        justify-content: center;
        justify-self: start;
        height: 2.6rem;
        padding: 0 0.95rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        background: var(--bg-elevated);
        box-shadow: var(--shadow-sm);
        color: var(--text-secondary);
        cursor: pointer;
        transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .docs-sidebar__close:hover {
        color: var(--text);
        background: var(--bg);
        border-color: var(--border-strong);
        transform: translateY(-1px);
      }

      .docs-sidebar__group {
        display: grid;
        gap: 0.25rem;
      }

      .docs-sidebar__group-title {
        color: var(--text-tertiary);
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 0.2rem 0.95rem;
      }

      .docs-sidebar__nav {
        display: grid;
        gap: 0.2rem;
      }

      .docs-sidebar__nav a {
        display: block;
        padding: 0.56rem 0.95rem;
        border-radius: 18px;
        color: var(--text-secondary);
        font-size: 0.92rem;
        font-weight: 500;
        transition: color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
      }

      .docs-sidebar__nav a:hover,
      .docs-sidebar__nav a:focus-visible {
        color: var(--text);
        background: var(--bg-muted);
        transform: translateX(2px);
      }

      .docs-sidebar__nav a[aria-current="page"] {
        color: var(--accent-hover);
        background: var(--accent-soft);
      }

      @media (max-width: 768px) {
        .docs-sidebar {
          display: block;
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 100;
          width: min(320px, calc(100vw - 2.5rem));
          transform: translateX(-100%);
          transition: transform 0.2s ease;
          pointer-events: none;
        }

        .site-mode-docs.docs-sidebar-open .docs-sidebar {
          transform: translateX(0);
          pointer-events: auto;
        }

        .docs-sidebar::before {
          content: "";
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .site-mode-docs.docs-sidebar-open .docs-sidebar::before {
          opacity: 1;
          pointer-events: auto;
        }

        .docs-sidebar__inner {
          position: relative;
          top: 0;
          height: 100vh;
          max-height: 100vh;
          padding: 1rem;
          background: var(--bg);
          border-right: 1px solid var(--border);
        }

        .docs-sidebar__close {
          display: inline-flex;
        }
      }
    </style>
    <aside class="docs-sidebar" id="docs-sidebar" aria-label="Roselt.js documentation">
      <div class="docs-sidebar__inner">
        <div class="docs-sidebar__header">
          <span class="docs-sidebar__kicker">Roselt.js Docs</span>
          <div class="docs-sidebar__title">Build from files, not route config.</div>
          <div class="docs-sidebar__body">
            Start with the minimal entry page, then move through routing, page lifecycle, shell components, reusable components, deployment, and the full API surface.
          </div>
          <button class="docs-sidebar__close" type="button" data-close-docs-sidebar>
            Close
          </button>
        </div>

        <div class="docs-sidebar__group">
          <div class="docs-sidebar__group-title">Start</div>
          <nav class="docs-sidebar__nav" aria-label="Getting started">
            <a href="?page=docs/getting-started">Getting started</a>
            <a href="?page=docs/installation">Installation</a>
            <a href="?page=docs/project-structure">Project structure</a>
          </nav>
        </div>

        <div class="docs-sidebar__group">
          <div class="docs-sidebar__group-title">Core concepts</div>
          <nav class="docs-sidebar__nav" aria-label="Core concepts">
            <a href="?page=docs/routing">Routing and navigation</a>
            <a href="?page=docs/pages">Pages</a>
            <a href="?page=docs/sections">Shell components</a>
            <a href="?page=docs/components">Components</a>
          </nav>
        </div>

        <div class="docs-sidebar__group">
          <div class="docs-sidebar__group-title">Reference</div>
          <nav class="docs-sidebar__nav" aria-label="Reference">
            <a href="?page=docs/metadata-seo">Metadata and SEO</a>
            <a href="?page=docs/deployment">Deployment</a>
            <a href="?page=docs/api-reference">API reference</a>
            <a href="?page=docs/faq">FAQ</a>
          </nav>
        </div>
      </div>
    </aside>
  `;

  this.connected = function () {
    if (globalThis.__roseltDocsSidebarInitialized) {
      return;
    }

    globalThis.__roseltDocsSidebarInitialized = true;

    document.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof Element) || !target.closest("[data-close-docs-sidebar]")) {
        return;
      }

      document.body.classList.remove("docs-sidebar-open");
    });
  };
});