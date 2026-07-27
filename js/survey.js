import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const form = document.querySelector("#survey-form");
if (!form) throw new Error("Survey form was not found.");

const language = form.dataset.language === "en" ? "en" : "ja";
const previewMode = new URLSearchParams(window.location.search).get("preview") === "open";
const messages = {
  ja: {
    closedHeading: "写真展は終了しました",
    closedMessage: "ご来場ならびにアンケートへのご協力、ありがとうございました。",
    upcomingHeading: "アンケートはまだ始まっていません",
    upcomingMessage: "写真展の開始後にご利用いただけます。",
    unavailableHeading: "現在ご利用いただけません",
    unavailableMessage: "公開状態を確認できませんでした。時間をおいて、もう一度お試しください。",
    select: "この作品を選ぶ",
    deselect: "選択を取り消す",
    selectedWorks: (count) => `選択した作品（${count}作品）`,
    noWorkComment: "（作品への感想なし）",
    overallHeading: "写真展全体への感想",
    noOverallComment: "（感想なし）",
    sending: "回答を送信しています…",
    connectionError: "アンケートの接続設定が完了していません。",
    received: "回答を受け付けました。",
    duplicate: "この端末からの回答はすでに受け付けています。",
    sendError: "送信できませんでした。通信環境を確認し、もう一度お試しください。",
    preview: "プレビュー表示中です。入力内容は送信できません。",
  },
  en: {
    closedHeading: "The exhibition has ended",
    closedMessage: "Thank you for visiting and for completing our survey.",
    upcomingHeading: "The survey has not opened yet",
    upcomingMessage: "It will be available after the exhibition opens.",
    unavailableHeading: "Currently unavailable",
    unavailableMessage: "We could not confirm availability. Please try again later.",
    select: "Select this work",
    deselect: "Remove selection",
    selectedWorks: (count) => `Selected works (${count})`,
    noWorkComment: "(No comment on this work)",
    overallHeading: "Comments on the exhibition",
    noOverallComment: "(No comment)",
    sending: "Submitting your response…",
    connectionError: "The survey connection has not been configured.",
    received: "Your response has been received.",
    duplicate: "A response from this device has already been received.",
    sendError: "Your response could not be submitted. Check your connection and try again.",
    preview: "Preview mode. Responses cannot be submitted.",
  },
}[language];
const exhibitionKey = form.dataset.exhibitionKey;
const supabaseUrl = form.dataset.supabaseUrl;
const supabaseKey = form.dataset.supabaseKey;
const readonlyUrl = form.dataset.readonlyUrl;
const storageKey = `photo-survey:${exhibitionKey}:submitted`;
const cards = [...form.querySelectorAll(".survey-work-card")];
const editor = form.querySelector("#survey-editor");
const review = form.querySelector("#survey-review");
const complete = form.querySelector("#survey-complete");
const unavailable = form.querySelector("#survey-unavailable");
const unavailableHeading = form.querySelector("#unavailable-heading");
const unavailableMessage = form.querySelector("#survey-unavailable-message");
const status = form.querySelector("#survey-status");
const selectionCount = form.querySelector("#selection-count");
const reviewButton = form.querySelector("#review-button");
const editButton = form.querySelector("#edit-button");
const submitButton = form.querySelector("#submit-button");
const reviewContent = form.querySelector("#review-content");
const overallComment = form.querySelector("#overall-comment");

let selectedIds = new Set();
let supabase;

function setStatus(message = "", type = "") {
  status.textContent = message;
  status.className = `survey-status${type ? ` is-${type}` : ""}`;
}

function showUnavailable(publicState = "unavailable") {
  editor.hidden = true;
  review.hidden = true;
  complete.hidden = true;
  unavailable.hidden = false;
  form.dataset.stateLoading = "false";
  setStatus();

  if (publicState === "closed") {
    unavailableHeading.textContent = messages.closedHeading;
    unavailableMessage.textContent = messages.closedMessage;
  } else if (publicState === "upcoming") {
    unavailableHeading.textContent = messages.upcomingHeading;
    unavailableMessage.textContent = messages.upcomingMessage;
  } else {
    unavailableHeading.textContent = messages.unavailableHeading;
    unavailableMessage.textContent = messages.unavailableMessage;
  }
}

async function getPublicState() {
  const { data, error } = await supabase.rpc("get_exhibition_public_state", {
    p_exhibition_key: exhibitionKey,
  });
  if (error) throw error;
  const publicState = Array.isArray(data) ? data[0] : data;
  return publicState?.state || "unavailable";
}

function updateCharacterCount(textarea) {
  const counter = textarea.parentElement.querySelector(".character-count");
  if (counter) counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
}

function updateSelectionUi() {
  const limitReached = selectedIds.size >= 3;
  selectionCount.textContent = String(selectedIds.size);
  reviewButton.disabled = selectedIds.size < 1;

  cards.forEach((card) => {
    const id = card.dataset.workId;
    const selected = selectedIds.has(id);
    const button = card.querySelector(".survey-select-button");
    const panel = card.querySelector(".work-comment-panel");
    card.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? messages.deselect : messages.select;
    button.disabled = !selected && limitReached;
    panel.hidden = !selected;
  });
}

function selectedAnswers() {
  return cards
    .filter((card) => selectedIds.has(card.dataset.workId))
    .map((card) => ({
      work_id: card.dataset.workId,
      title: card.querySelector(".work-title")?.textContent.trim() || "",
      comment: card.querySelector(".work-comment").value.trim(),
    }));
}

function renderReview() {
  reviewContent.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = messages.selectedWorks(selectedIds.size);
  reviewContent.append(heading);

  selectedAnswers().forEach((answer) => {
    const item = document.createElement("section");
    item.className = "review-work";
    const title = document.createElement("h3");
    title.textContent = `No.${answer.work_id.padStart(2, "0")} ${answer.title}`;
    const comment = document.createElement("p");
    comment.className = "review-comment";
    comment.textContent = answer.comment || messages.noWorkComment;
    item.append(title, comment);
    reviewContent.append(item);
  });

  const overallHeading = document.createElement("h3");
  overallHeading.textContent = messages.overallHeading;
  const overall = document.createElement("p");
  overall.className = "review-comment";
  overall.textContent = overallComment.value.trim() || messages.noOverallComment;
  reviewContent.append(overallHeading, overall);
}

cards.forEach((card) => {
  card.querySelector(".survey-select-button").addEventListener("click", () => {
    const id = card.dataset.workId;
    selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
    updateSelectionUi();
  });
});

form.querySelectorAll("textarea").forEach((textarea) => {
  textarea.addEventListener("input", () => updateCharacterCount(textarea));
});

reviewButton.addEventListener("click", () => {
  if (selectedIds.size < 1 || selectedIds.size > 3) return;
  renderReview();
  editor.hidden = true;
  review.hidden = false;
  review.scrollIntoView({ behavior: "smooth", block: "start" });
});

editButton.addEventListener("click", () => {
  review.hidden = true;
  editor.hidden = false;
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (selectedIds.size < 1 || selectedIds.size > 3) return;
  if (previewMode) {
    setStatus(messages.preview, "error");
    return;
  }

  submitButton.disabled = true;
  form.classList.add("survey-is-busy");
  setStatus(messages.sending);

  try {
    if (!supabase) throw new Error(messages.connectionError);
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
    }

    const payload = selectedAnswers().map(({ work_id, comment }) => ({ work_id, comment }));
    const { error } = await supabase.rpc("submit_survey", {
      p_exhibition_key: exhibitionKey,
      p_overall_comment: overallComment.value.trim(),
      p_selections: payload,
    });
    if (error) throw error;

    localStorage.setItem(storageKey, new Date().toISOString());
    review.hidden = true;
    complete.hidden = false;
    setStatus(messages.received, "success");
    complete.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    const duplicate = error?.code === "23505" || /already submitted/i.test(error?.message || "");
    setStatus(duplicate ? messages.duplicate : messages.sendError, "error");
    submitButton.disabled = false;
  } finally {
    form.classList.remove("survey-is-busy");
  }
});

async function initializeSurvey() {
  if (!supabaseUrl?.startsWith("https://") || !supabaseKey || supabaseKey === "YOUR_PUBLISHABLE_KEY") {
    showUnavailable();
    return;
  }

  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  try {
    if (!previewMode) {
      const publicState = await getPublicState();
      if (publicState !== "open") {
        showUnavailable(publicState);
        return;
      }
    }

    if (!previewMode && localStorage.getItem(storageKey)) {
      window.location.replace(readonlyUrl);
      return;
    }

    unavailable.hidden = true;
    editor.hidden = false;
    form.dataset.stateLoading = "false";
    updateSelectionUi();
    if (previewMode) setStatus(messages.preview);
  } catch (error) {
    console.error("Failed to load exhibition state.", error);
    showUnavailable();
  }
}

initializeSurvey();
