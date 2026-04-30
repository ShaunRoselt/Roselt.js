function initializeDocsSidebar() {
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
}

initializeDocsSidebar();