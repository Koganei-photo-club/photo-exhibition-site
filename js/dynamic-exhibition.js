import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const root = document.querySelector("#dynamic-exhibition");
if (!root) throw new Error("Dynamic exhibition root was not found.");

const params = new URLSearchParams(location.search);
const key = params.get("key") || "";
const mode = root.dataset.mode;
const storageKey = `photo-exhibition:${key}:language`;
const requested = params.get("lang");
const saved = localStorage.getItem(storageKey);
let language = requested === "ja" || requested === "en"
  ? requested
  : saved || ((navigator.language || "").toLowerCase().startsWith("ja") ? "ja" : "en");
localStorage.setItem(storageKey, language);
document.documentElement.lang = language;

const text = (ja, en) => language === "en" ? en : ja;
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[char]);
const local = (ja, en) => language === "en" && en?.trim() ? en : ja || "";
const queryUrl = (path, lang = language) => {
  const url = new URL(path, location.origin);
  url.searchParams.set("key", key);
  url.searchParams.set("lang", lang);
  return url.href;
};
const publicImageUrl = (path) => path
  ? `${root.dataset.supabaseUrl}/storage/v1/object/public/exhibition-public/${path.split("/").map(encodeURIComponent).join("/")}`
  : "";
const fmt = (value, options) => value
  ? new Intl.DateTimeFormat(language === "en" ? "en-US" : "ja-JP", options).format(new Date(value))
  : "";

root.querySelectorAll("[data-language]").forEach((link) => {
  const lang = link.dataset.language;
  link.href = queryUrl(location.pathname, lang);
  if (lang === language) link.setAttribute("aria-current", "page");
  link.onclick = () => localStorage.setItem(storageKey, lang);
});

const status = root.querySelector("#dynamic-status");
const content = root.querySelector("#dynamic-content");
const unavailable = (message) => {
  status.textContent = message;
  content.innerHTML = `<section class="entry-panel"><h1>${text("現在ご利用いただけません", "Currently unavailable")}</h1><p>${text("写真展情報を確認できませんでした。", "The exhibition information could not be loaded.")}</p></section>`;
};

function workCard(work, selectable = false) {
  const image = work.imagePublic && work.publicImagePath
    ? `<div class="photo-wrapper" data-full="${esc(publicImageUrl(work.publicImagePath))}"><div class="photo" style="background-image:url('${esc(publicImageUrl(work.publicImagePath))}')"></div><button class="photo-overlay" type="button" aria-label="${text("この作品画像を拡大表示", "Enlarge this image")}"></button></div>`
    : `<div class="photo-wrapper photo-unavailable" role="img"><img src="${esc(root.dataset.logoUrl)}" alt=""><strong>NO IMAGE</strong><span>${text("作品画像は非公開です", "The image is not available online.")}</span></div>`;
  return `<article class="work-card${selectable ? " survey-work-card" : ""}" data-work-id="${esc(work.workUuid)}">${image}<div class="work-info"><p class="work-number">No.${esc(work.displayNo)}</p><p class="work-title">${esc(local(work.title, work.titleEn))}</p><p class="work-author">${esc(work.artist)}</p>${work.camera ? `<p class="work-camera">${esc(work.camera)}</p>` : ""}${work.lensOther ? `<p class="work-lens">${esc(work.lensOther)}</p>` : ""}${local(work.description, work.descriptionEn) ? `<p class="work-description">${esc(local(work.description, work.descriptionEn))}</p>` : ""}${selectable ? `<button class="survey-select-button" type="button" aria-pressed="false">${text("この作品を選ぶ", "Select this work")}</button><div class="work-comment-panel" hidden><label>${text("この作品への感想（任意）", "Comment on this work (optional)")}<textarea class="work-comment" maxlength="1000" rows="4"></textarea></label></div>` : ""}</div></article>`;
}

function setupLightbox() {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = "<img alt=\"\">";
  document.body.append(box);
  content.querySelectorAll(".photo-overlay").forEach((button) => button.onclick = () => {
    box.querySelector("img").src = button.closest(".photo-wrapper").dataset.full;
    box.classList.add("active");
  });
  box.onclick = (event) => { if (event.target === box) box.classList.remove("active"); };
}

function renderEntry(data) {
  const ended = data.siteStatus === "ended";
  content.innerHTML = `<div class="entry-intro"><h1>${esc(local(data.title, data.titleEn))}</h1>${local(data.catchphrase, data.catchphraseEn) ? `<p class="dynamic-catchphrase">${esc(local(data.catchphrase, data.catchphraseEn))}</p>` : ""}<div class="dm-image entry-dm-image"><img src="${esc(publicImageUrl(data.dmImagePath))}" alt="${esc(local(data.title, data.titleEn))}"></div><div class="entry-event-details"><p><strong>${text("開催日時：", "Dates: ")}</strong>${esc(fmt(data.startsAt, { dateStyle: "long", timeStyle: "short" }))}${data.endsAt ? ` – ${esc(fmt(data.endsAt, { dateStyle: "long", timeStyle: "short" }))}` : ""}</p><p><strong>${text("会場：", "Venue: ")}</strong>${esc(local(data.place, data.placeEn))}</p>${local(data.additionalInfo, data.additionalInfoEn) ? `<p>${esc(local(data.additionalInfo, data.additionalInfoEn))}</p>` : ""}</div><p class="dynamic-description">${esc(local(data.description, data.descriptionEn))}</p></div><section class="entry-panel"><h2>${ended ? text("写真展は終了しました", "The exhibition has ended") : text("ご来場ありがとうございます", "Thank you for visiting")}</h2>${ended ? `<p>${text("このページは開催記録として公開しています。作品一覧とアンケートの受付は終了しました。", "This page remains available as an exhibition record. The gallery and survey are no longer public.")}</p>` : `<div class="entry-actions"><a class="entry-primary-button" href="${esc(queryUrl(`${root.dataset.baseUrl}survey/`))}">${text("アンケート付き作品一覧", "Gallery and survey")}</a><a class="entry-secondary-button" href="${esc(queryUrl(`${root.dataset.baseUrl}works/`))}">${text("作品一覧のみ", "Gallery only")}</a></div>`}</section>`;
}

function renderWorks(data) {
  if (data.siteStatus === "ended") return unavailable(text("作品一覧の公開は終了しました。", "The gallery is no longer public."));
  content.innerHTML = `<h1>${esc(local(data.title, data.titleEn))}</h1><p>${text("作品一覧", "Gallery")}</p><div class="work-gallery">${data.works.map((work) => workCard(work)).join("")}</div><p><a class="button" href="${esc(queryUrl(root.dataset.baseUrl))}">${text("写真展ページへ戻る", "Return to the exhibition page")}</a></p>`;
  setupLightbox();
}

async function renderSurvey(data, client) {
  const { data: stateRows, error } = await client.rpc("get_exhibition_survey_state", { p_exhibition_key: key });
  if (error) throw error;
  const surveyState = Array.isArray(stateRows) ? stateRows[0]?.state : stateRows?.state;
  if (surveyState !== "open") return unavailable(surveyState === "upcoming" ? text("アンケートはまだ始まっていません。", "The survey has not opened yet.") : text("アンケートの受付は終了しています。", "The survey is closed."));
  content.innerHTML = `<h1>${esc(local(data.title, data.titleEn))}</h1><div class="survey-status" id="survey-message"></div><form id="dynamic-survey"><div class="survey-heading-row"><h2>${text("お気に入りの作品", "Your favorite works")}</h2><p><strong id="selection-count">0</strong> / 3</p></div><p>${text("1作品以上、3作品以下を選択してください。作品への感想は任意です。", "Select between one and three works. Comments are optional.")}</p><div class="work-gallery survey-gallery">${data.works.map((work) => workCard(work, true)).join("")}</div><section class="overall-comment-section"><h2>${text("写真展全体への感想", "Comments on the exhibition")}</h2><p>${text("氏名・メールアドレスなどの個人情報は入力しないでください。", "Do not enter personal information such as your name or email address.")}</p><textarea id="overall-comment" maxlength="2000" rows="7"></textarea></section><div class="survey-actions"><button id="submit-survey" class="survey-primary-button" disabled>${text("回答内容を確認して送信", "Review and submit")}</button></div></form>`;
  setupLightbox();
  const selected = new Set();
  const cards = [...content.querySelectorAll(".survey-work-card")];
  const update = () => {
    content.querySelector("#selection-count").textContent = selected.size;
    content.querySelector("#submit-survey").disabled = selected.size < 1;
    cards.forEach((card) => {
      const active = selected.has(card.dataset.workId), button = card.querySelector(".survey-select-button");
      card.classList.toggle("is-selected", active); button.setAttribute("aria-pressed", active); button.textContent = active ? text("選択を取り消す", "Remove selection") : text("この作品を選ぶ", "Select this work"); button.disabled = !active && selected.size >= 3; card.querySelector(".work-comment-panel").hidden = !active;
    });
  };
  cards.forEach((card) => card.querySelector(".survey-select-button").onclick = () => { selected.has(card.dataset.workId) ? selected.delete(card.dataset.workId) : selected.add(card.dataset.workId); update(); });
  content.querySelector("#dynamic-survey").onsubmit = async (event) => {
    event.preventDefault();
    if (!confirm(text(`${selected.size}作品を選択しています。この内容で送信しますか？`, `You selected ${selected.size} works. Submit this response?`))) return;
    const button = content.querySelector("#submit-survey"); button.disabled = true;
    let token = localStorage.getItem(`photo-survey:${key}:token`);
    if (!token) { token = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem(`photo-survey:${key}:token`, token); }
    const selections = cards.filter((card) => selected.has(card.dataset.workId)).map((card) => ({ work_id: card.dataset.workId, comment: card.querySelector(".work-comment").value.trim() }));
    const { error: submitError } = await client.rpc("submit_exhibition_survey", { p_exhibition_key: key, p_respondent_token: token, p_language: language, p_overall_comment: content.querySelector("#overall-comment").value.trim(), p_selections: selections });
    if (submitError) { content.querySelector("#survey-message").textContent = submitError.code === "23505" ? text("この端末からの回答はすでに受け付けています。", "A response from this device has already been received.") : text("回答を送信できませんでした。", "The response could not be submitted."); button.disabled = false; return; }
    content.innerHTML = `<section class="survey-complete"><h2>${text("ご協力ありがとうございました", "Thank you for your response")}</h2><p>${text("回答を受け付けました。", "Your response has been received.")}</p><a class="button" href="${esc(queryUrl(`${root.dataset.baseUrl}works/`))}">${text("作品一覧を見る", "View the gallery")}</a></section>`;
  };
}

async function initialize() {
  if (!key) return unavailable(text("写真展キーが指定されていません。", "No exhibition key was specified."));
  try {
    const client = createClient(root.dataset.supabaseUrl, root.dataset.supabaseKey, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("get_public_exhibition", { p_exhibition_key: key });
    if (error) throw error;
    if (!data) return unavailable(text("この写真展は現在公開されていません。", "This exhibition is not currently public."));
    status.textContent = "";
    if (mode === "entry") renderEntry(data);
    else if (mode === "works") renderWorks(data);
    else await renderSurvey(data, client);
  } catch (error) { console.error(error); unavailable(text("読み込みに失敗しました。", "Failed to load the exhibition.")); }
}

initialize();
