(() => {
  const root = document.querySelector("[data-language-root]");
  if (!root) return;

  const currentLanguage = root.dataset.language === "en" ? "en" : "ja";
  const params = new URLSearchParams(window.location.search);
  const requestedLanguage = params.get("lang");
  const storageKey = "photo-exhibition:2026-summer:language";

  if (requestedLanguage === "ja" || requestedLanguage === "en") {
    localStorage.setItem(storageKey, requestedLanguage);
  }

  const savedLanguage = localStorage.getItem(storageKey);
  const deviceLanguage = (navigator.language || "").toLowerCase();
  const preferredLanguage = requestedLanguage
    || savedLanguage
    || (deviceLanguage.startsWith("ja") ? "ja" : "en");

  if (root.dataset.autoLanguage === "true" && preferredLanguage === "en") {
    const destination = new URL(root.dataset.englishUrl, window.location.origin);
    params.delete("lang");
    params.forEach((value, key) => destination.searchParams.set(key, value));
    destination.searchParams.set("lang", "en");
    window.location.replace(destination);
    return;
  }

  document.querySelectorAll("[data-language]").forEach((link) => {
    const linkLanguage = link.dataset.language;
    if (linkLanguage === currentLanguage) link.setAttribute("aria-current", "page");

    link.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.setItem(storageKey, linkLanguage);
      const destination = new URL(link.href);
      if (params.get("preview")) destination.searchParams.set("preview", params.get("preview"));
      window.location.assign(destination);
    });
  });

  document.querySelectorAll(".preserve-preview").forEach((link) => {
    if (!params.get("preview")) return;
    const destination = new URL(link.href);
    destination.searchParams.set("preview", params.get("preview"));
    link.href = destination;
  });
})();
