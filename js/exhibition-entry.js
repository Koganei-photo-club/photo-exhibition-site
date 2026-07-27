import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const entry = document.querySelector("#exhibition-entry");
if (!entry) throw new Error("Exhibition entry was not found.");

const status = entry.querySelector("#entry-status");
const panels = {
  upcoming: entry.querySelector("#entry-upcoming"),
  open: entry.querySelector("#entry-open"),
  closed: entry.querySelector("#entry-closed"),
  unavailable: entry.querySelector("#entry-unavailable"),
};

const previewState = new URLSearchParams(window.location.search).get("preview");

function showPanel(state, opensAt = null, isPreview = false) {
  Object.values(panels).forEach((panel) => { panel.hidden = true; });
  const selected = panels[state] || panels.unavailable;
  selected.hidden = false;
  status.textContent = isPreview
    ? "プレビュー表示中です。アンケートの回答受付は有効になっていません。"
    : "";
  status.classList.toggle("entry-status-preview", isPreview);

  if (state === "upcoming" && opensAt) {
    const target = entry.querySelector("#entry-opens-at");
    const formatted = new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Tokyo",
    }).format(new Date(opensAt));
    target.textContent = `公開予定：${formatted}`;
  }
}

async function loadState() {
  if (previewState === "open") {
    showPanel("open", null, true);
    return;
  }

  const supabaseUrl = entry.dataset.supabaseUrl;
  const supabaseKey = entry.dataset.supabaseKey;
  const exhibitionKey = entry.dataset.exhibitionKey;

  if (!supabaseUrl?.startsWith("https://") || !supabaseKey || !exhibitionKey) {
    showPanel("unavailable");
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.rpc("get_exhibition_public_state", {
      p_exhibition_key: exhibitionKey,
    });
    if (error) throw error;

    const publicState = Array.isArray(data) ? data[0] : data;
    showPanel(publicState?.state || "unavailable", publicState?.opens_at);
  } catch (error) {
    console.error("Failed to load exhibition state.", error);
    showPanel("unavailable");
  }
}

loadState();
