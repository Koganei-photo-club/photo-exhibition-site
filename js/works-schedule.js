(() => {
  const root = document.querySelector("#scheduled-works");
  if (!root || root.dataset.stateProvider !== "static_schedule") return;

  const params = new URLSearchParams(window.location.search);
  const previewOpen = params.get("preview") === "open";
  const language = root.dataset.language === "en" ? "en" : "ja";
  const status = root.querySelector("#works-schedule-status");
  const content = root.querySelector("#works-scheduled-content");
  const opensAt = root.dataset.opensAt ? new Date(root.dataset.opensAt) : null;
  const closesAt = root.dataset.closesAt ? new Date(root.dataset.closesAt) : null;
  const now = new Date();
  const upcoming = opensAt && !Number.isNaN(opensAt.getTime()) && now < opensAt;
  const closed = closesAt && !Number.isNaN(closesAt.getTime()) && now > closesAt;

  if (!previewOpen && (upcoming || closed)) {
    const destination = new URL(root.dataset.entryUrl, window.location.origin);
    destination.searchParams.set("lang", language);
    window.location.replace(destination);
    return;
  }

  root.dataset.stateLoading = "false";
  content.hidden = false;
  status.textContent = previewOpen
    ? (language === "en" ? "Preview mode" : "プレビュー表示中です。")
    : "";
})();
