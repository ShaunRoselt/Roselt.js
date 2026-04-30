Roselt.Page.Title = "Page Not Found | Roselt.js";
Roselt.Page.Description = "The requested Roselt.js documentation page could not be found.";

Roselt.Page.Load = () => {
  const missingUrl = Roselt.Page.querySelector("[data-missing-url]");

  if (missingUrl instanceof HTMLElement && Roselt.Page.notFound?.url instanceof URL) {
    missingUrl.textContent = `${Roselt.Page.notFound.url.pathname}${Roselt.Page.notFound.url.search}`;
  }
};