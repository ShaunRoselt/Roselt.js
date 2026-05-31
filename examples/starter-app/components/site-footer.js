Roselt.defineComponent({
  shadow: false,

  render() {
    return `
      <style>
        .site-footer__inner {
          font-size: 0.95rem;
        }
      </style>
      <footer class="site-footer">
        <div class="site-footer__inner">
          <span>Built with Roselt.js</span>
          <span>Edit the starter files and shape the app from there.</span>
        </div>
      </footer>
    `;
  }
});