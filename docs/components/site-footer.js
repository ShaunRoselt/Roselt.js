Roselt.defineComponent(function () {
  this.shadow = false;

  this.render = () => `
    <style>
      .site-footer {
        margin-top: 4.5rem;
        border-top: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), var(--bg-soft));
      }

      .site-footer__inner {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) repeat(4, minmax(0, 1fr));
        gap: 2rem 3rem;
        width: var(--site-width);
        margin: 0 auto;
        padding: 3.25rem 0 3.5rem;
      }

      .site-footer__brand {
        display: grid;
        align-content: start;
        gap: 1rem;
      }

      .site-footer__brand-link {
        display: inline-flex;
        align-items: center;
        gap: 0.95rem;
        width: fit-content;
      }

      .site-footer__brand-mark {
        width: 3rem;
        height: 3rem;
        border-radius: 18px;
        box-shadow: 0 18px 40px rgba(20, 158, 202, 0.18);
      }

      .site-footer__brand-copy {
        display: grid;
        gap: 0.12rem;
      }

      .site-footer__brand-copy strong {
        font-size: 1.08rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .site-footer__brand-copy span {
        color: var(--text-tertiary);
        font-size: 0.9rem;
      }

      .site-footer__summary,
      .site-footer__legal {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.95rem;
        line-height: 1.7;
      }

      .site-footer__legal {
        color: var(--text-tertiary);
        font-size: 0.82rem;
      }

      .site-footer__social {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
      }

      .site-footer__social-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--bg-elevated);
        color: var(--text-secondary);
        box-shadow: var(--shadow-sm);
        transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
      }

      .site-footer__social-link:hover,
      .site-footer__social-link:focus-visible {
        transform: translateY(-1px);
        border-color: var(--border-strong);
        background: var(--bg);
        color: var(--text);
      }

      .site-footer__group {
        display: grid;
        align-content: start;
        gap: 0.85rem;
      }

      .site-footer__heading {
        color: var(--text);
        font-size: 0.96rem;
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .site-footer__nav {
        display: grid;
        gap: 0.65rem;
      }

      .site-footer__nav a {
        width: fit-content;
        color: var(--text-secondary);
        font-size: 0.9rem;
        line-height: 1.5;
        border-bottom: 1px solid transparent;
        transition: color 0.15s ease, border-color 0.15s ease;
      }

      .site-footer__nav a:hover,
      .site-footer__nav a:focus-visible {
        color: var(--text);
        border-color: var(--border-strong);
      }

      @media (max-width: 1100px) {
        .site-footer__inner {
          grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 1fr));
        }

        .site-footer__brand {
          grid-column: 1 / -1;
          max-width: 32rem;
        }
      }

      @media (max-width: 768px) {
        .site-footer__inner {
          grid-template-columns: 1fr 1fr;
          gap: 1.6rem 2rem;
        }
      }

      @media (max-width: 560px) {
        .site-footer__inner {
          grid-template-columns: 1fr;
          padding: 2.5rem 0 3rem;
        }

        .site-footer__brand,
        .site-footer__group {
          max-width: none;
        }
      }
    </style>
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__brand">
          <a class="site-footer__brand-link" href="?page=home" aria-label="Roselt.js home">
            <img class="site-footer__brand-mark" src="assets/roselt-logo.svg" alt="">
            <div class="site-footer__brand-copy">
              <strong>Roselt.js</strong>
              <span>File-based apps for the web, desktop, and static delivery.</span>
            </div>
          </a>

          <p class="site-footer__summary">
            Build routed apps with real pages, reusable components, and platform-friendly routing that stays close to the browser.
          </p>

          <div class="site-footer__social" aria-label="Roselt.js links">
            <a class="site-footer__social-link" href="?page=home" aria-label="Roselt.js home">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
            </a>
            <a class="site-footer__social-link" href="?page=docs/getting-started" aria-label="Roselt.js docs">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path></svg>
            </a>
            <a class="site-footer__social-link" href="https://github.com/ShaunRoselt/Roselt.js" target="_blank" rel="noreferrer" aria-label="Roselt.js on GitHub">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.76 2.67 1.25 3.32.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.17a10.88 10.88 0 0 1 5.78 0c2.2-1.48 3.17-1.17 3.17-1.17.62 1.59.23 2.76.11 3.05.73.8 1.18 1.82 1.18 3.07 0 4.41-2.7 5.39-5.27 5.67.41.36.78 1.08.78 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12C23.5 5.66 18.35.5 12 .5Z"></path></svg>
            </a>
          </div>

          <div class="site-footer__legal">MIT licensed. Designed and maintained by Shaun Roselt.</div>
        </div>

        <div class="site-footer__group">
          <div class="site-footer__heading">Learn Roselt.js</div>
          <nav class="site-footer__nav" aria-label="Learn Roselt.js">
            <a href="?page=docs/getting-started">Getting started</a>
            <a href="?page=docs/installation">Installation</a>
            <a href="?page=docs/project-structure">Project structure</a>
            <a href="?page=docs/routing">Routing and navigation</a>
          </nav>
        </div>

        <div class="site-footer__group">
          <div class="site-footer__heading">Build</div>
          <nav class="site-footer__nav" aria-label="Build with Roselt.js">
            <a href="?page=docs/pages">Pages</a>
            <a href="?page=docs/sections">Shell components</a>
            <a href="?page=docs/components">Components</a>
            <a href="?page=docs/deployment">Deployment</a>
          </nav>
        </div>

        <div class="site-footer__group">
          <div class="site-footer__heading">Reference</div>
          <nav class="site-footer__nav" aria-label="Roselt.js reference">
            <a href="?page=docs/metadata-seo">Metadata and SEO</a>
            <a href="?page=docs/api-reference">API reference</a>
            <a href="?page=docs/faq">FAQ</a>
          </nav>
        </div>

        <div class="site-footer__group">
          <div class="site-footer__heading">Project</div>
          <nav class="site-footer__nav" aria-label="Roselt.js project links">
            <a href="https://github.com/ShaunRoselt/Roselt.js" target="_blank" rel="noreferrer">Repository</a>
            <a href="https://github.com/ShaunRoselt/Roselt.js/blob/main/README.md" target="_blank" rel="noreferrer">README</a>
            <a href="https://github.com/ShaunRoselt/Roselt.js/tree/main/examples/admin-demo" target="_blank" rel="noreferrer">Example app</a>
            <a href="?page=blog">Blog</a>
            <a href="https://github.com/ShaunRoselt/Roselt.js/blob/main/LICENSE" target="_blank" rel="noreferrer">License</a>
          </nav>
        </div>
      </div>
    </footer>
  `;
});