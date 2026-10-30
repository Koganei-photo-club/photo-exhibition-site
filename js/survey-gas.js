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
    select: "この作品を選ぶ", deselect: "選択を取り消す",
    selectedWorks: (count) => `選択した作品（${count}作品）`,
    noWorkComment: "（作品への感想なし）", overallHeading: "写真展全体への感想", noOverallComment: "（感想なし）",
    sending: "回答を送信しています…", received: "回答を受け付けました。",
    duplicate: "この端末からの回答はすでに受け付けています。",
    sendError: "送信できませんでした。通信環境を確認し、もう一度お試しください。",
    preview: "プレビュー表示中です。入力内容は送信できません。",
  },
  en: {
    closedHeading: "The exhibition has ended", closedMessage: "Thank you for visiting and for completing our survey.",
    upcomingHeading: "The survey has not opened yet", upcomingMessage: "It will be available after the exhibition opens.",
    unavailableHeading: "Currently unavailable", unavailableMessage: "We could not confirm availability. Please try again later.",
    select: "Select this work", deselect: "Remove selection",
    selectedWorks: (count) => `Selected works (${count})`,
    noWorkComment: "(No comment on this work)", overallHeading: "Comments on the exhibition", noOverallComment: "(No comment)",
    sending: "Submitting your response…", received: "Your response has been received.",
    duplicate: "A response from this device has already been received.",
    sendError: "Your response could not be submitted. Check your connection and try again.",
    preview: "Preview mode. Responses cannot be submitted.",
  },
}[language];

const exhibitionKey = form.dataset.exhibitionKey;
const gasUrl = form.dataset.gasUrl;
const readonlyUrl = form.dataset.readonlyUrl;
const submittedKey = `photo-survey:${exhibitionKey}:submitted`;
const pendingKey = `photo-survey:${exhibitionKey}:pending-submission-id`;
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
const selectedIds = new Set();

function setStatus(message = "", type = "") {
  status.textContent = message;
  status.className = `survey-status${type ? ` is-${type}` : ""}`;
}

function showUnavailable(publicState = "unavailable") {
  editor.hidden = true; review.hidden = true; complete.hidden = true; unavailable.hidden = false;
  form.dataset.stateLoading = "false"; setStatus();
  if (publicState === "closed") {
    unavailableHeading.textContent = messages.closedHeading; unavailableMessage.textContent = messages.closedMessage;
  } else if (publicState === "upcoming") {
    unavailableHeading.textContent = messages.upcomingHeading; unavailableMessage.textContent = messages.upcomingMessage;
  } else {
    unavailableHeading.textContent = messages.unavailableHeading; unavailableMessage.textContent = messages.unavailableMessage;
  }
}

async function gasRequest(options = {}) {
  const response = await fetch(gasUrl, { redirect: "follow", cache: "no-store", ...options });
  if (!response.ok) throw new Error(`GAS HTTP ${response.status}`);
  const data = await response.json();
  if (!data || typeof data.ok !== "boolean") throw new Error("Invalid GAS response");
  return data;
}

function pendingSubmissionId() {
  let value = localStorage.getItem(pendingKey);
  if (!value) {
    value = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(pendingKey, value);
  }
  return value;
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
    const selected = selectedIds.has(card.dataset.workId);
    const button = card.querySelector(".survey-select-button");
    card.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? messages.deselect : messages.select;
    button.disabled = !selected && limitReached;
    card.querySelector(".work-comment-panel").hidden = !selected;
  });
}

function selectedAnswers() {
  return cards.filter((card) => selectedIds.has(card.dataset.workId)).map((card) => ({
    work_id: card.dataset.workId,
    work_no: Number(card.dataset.workNo),
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
    const item = document.createElement("section"); item.className = "review-work";
    const title = document.createElement("h3"); title.textContent = `No.${String(answer.work_no).padStart(2, "0")} ${answer.title}`;
    const comment = document.createElement("p"); comment.className = "review-comment"; comment.textContent = answer.comment || messages.noWorkComment;
    item.append(title, comment); reviewContent.append(item);
  });
  const overallHeading = document.createElement("h3"); overallHeading.textContent = messages.overallHeading;
  const comment = document.createElement("p"); comment.className = "review-comment"; comment.textContent = overallComment.value.trim() || messages.noOverallComment;
  reviewContent.append(overallHeading, comment);
}

cards.forEach((card) => card.querySelector(".survey-select-button").addEventListener("click", () => {
  selectedIds.has(card.dataset.workId) ? selectedIds.delete(card.dataset.workId) : selectedIds.add(card.dataset.workId);
  updateSelectionUi();
}));
form.querySelectorAll("textarea").forEach((textarea) => textarea.addEventListener("input", () => updateCharacterCount(textarea)));
reviewButton.addEventListener("click", () => {
  if (selectedIds.size < 1 || selectedIds.size > 3) return;
  renderReview(); editor.hidden = true; review.hidden = false; review.scrollIntoView({ behavior: "smooth", block: "start" });
});
editButton.addEventListener("click", () => {
  review.hidden = true; editor.hidden = false; editor.scrollIntoView({ behavior: "smooth", block: "start" });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (selectedIds.size < 1 || selectedIds.size > 3) return;
  if (previewMode) return setStatus(messages.preview, "error");
  submitButton.disabled = true; form.classList.add("survey-is-busy"); setStatus(messages.sending);
  const submissionId = pendingSubmissionId();
  const payload = {
    action: "submit",
    exhibition_key: exhibitionKey,
    submission_id: submissionId,
    language,
    overall_comment: overallComment.value.trim(),
    selections: selectedAnswers().map(({ work_id, work_no, title, comment }) => ({
      work_id,
      display_no: work_no,
      work_title: title,
      work_comment: comment,
    })),
  };
  try {
    const result = await gasRequest({ method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    if (!result.ok) {
      const error = new Error(result.message || messages.sendError); error.code = result.code; throw error;
    }
    localStorage.setItem(submittedKey, JSON.stringify({ submitted_at: new Date().toISOString(), submission_id: result.submission_id || submissionId }));
    localStorage.removeItem(pendingKey);
    review.hidden = true; complete.hidden = false; setStatus(messages.received, "success");
    complete.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    const duplicate = ["DUPLICATE_RESPONSE", "ALREADY_SUBMITTED"].includes(error.code) || /already|すでに/.test(error.message || "");
    setStatus(duplicate ? messages.duplicate : messages.sendError, "error"); submitButton.disabled = false;
  } finally { form.classList.remove("survey-is-busy"); }
});

async function initializeSurvey() {
  if (!gasUrl?.startsWith("https://script.google.com/macros/s/")) return showUnavailable();
  try {
    if (!previewMode) {
      const state = await gasRequest();
      if (!state.ok || state.state !== "open") return showUnavailable(state.state || "unavailable");
      if (localStorage.getItem(submittedKey)) return window.location.replace(readonlyUrl);
    }
    unavailable.hidden = true; editor.hidden = false; form.dataset.stateLoading = "false"; updateSelectionUi();
    if (previewMode) setStatus(messages.preview);
  } catch (error) { console.error(error); showUnavailable(); }
}

initializeSurvey();
