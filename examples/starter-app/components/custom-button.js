Roselt.defineComponent("custom-button", class CustomButton extends HTMLElement {
  static observedAttributes = ["href", "target", "variant"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    const href = this.getAttribute("href") || "#";
    const label = this.innerHTML.trim() || "Button";
    const target = this.getAttribute("target");
    const variant = this.getAttribute("variant") === "secondary" ? "secondary" : "primary";
    const targetAttributes = target ? ` target="${escapeAttribute(target)}" rel="noreferrer"` : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
        }

        a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 2.9rem;
          padding: 0.75rem 1.15rem;
          border: 1px solid transparent;
          border-radius: 999px;
          color: inherit;
          font: inherit;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.15s ease, border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
        }

        a:hover {
          transform: translateY(-1px);
        }

        a[data-variant="primary"] {
          background: var(--accent, #f97316);
          color: #111827;
        }

        a[data-variant="secondary"] {
          border-color: var(--surface-border, rgba(148, 163, 184, 0.2));
          background: transparent;
          color: var(--text-primary, #e2e8f0);
        }
      </style>
      <a href="${escapeAttribute(href)}" data-variant="${variant}"${targetAttributes}><slot>${label}</slot></a>
    `;
  }
});

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
