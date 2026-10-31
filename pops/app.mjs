import {
  APP_VERSION, BEATS, CARD_FIELDS, CRISIS_MESSAGE, DEPTHS, MAX_ALTERNATIVES, POPS_STAGES, PROFESSIONAL_NOTE,
  STORAGE_KEYS, VALUE_LENS, answerBeat, assessSafety, beatsFor, buildCard, cleanText, createDecisionEntry, createJournalEntry,
  createSession, exportJournal, goBack, isComplete, jumpTo, nudgeSummary, parseJournal, selectOptions, skipBeat
} from "./logic.mjs";
import {
  DEFAULT_REMINDER, EVENING_KEYS, MOOD_CHIPS, OBSERVE_CHIPS, POPR_STAGES, REFLECT_CHIPS, buildReminderICS, createReflectionEntry,
  dayKey, eveningSafety, formatTime, knownPeople, parseICSEvents, probeFor, questionForDate, reflectionStats, reminderDue,
  statsLine, suggestsDecision
} from "./evening.mjs";
import {
  DEFAULT_MORNING_REMINDER, INTENTION_CHIPS, INTENTION_PROMPT, MORNING_KEYS, LINES, MANTRA_COMMENT_CHIPS, MANTRA_HIDDEN_KEY, createMantraEntry, MOOD_PROMPT, MORNING_MOODS, createMorningEntry, morningIntentionFor, morningMoodFor, selectMantra
} from "./morning.mjs";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

// Only the Journal, the Current label, and the nudge preference are ever written to storage,
// and each only after an explicit tap. The active reflection lives in memory only.
const state = {
  view: "home",
  current: safeGet(STORAGE_KEYS.current) || "Choose your focus",
  nudges: readJSON(STORAGE_KEYS.nudges, { mode: "no" }),
  journal: parseJournal(safeGet(STORAGE_KEYS.journal)),
  session: null,
  draftAlternatives: [],
  customAnswer: false,
  returnTo: null,
  crisisFrom: null,
  journalMode: "read",
  openEntryId: null,
  savedSessionId: null,
  storageOk: storageAvailable(),
  evening: null, // the active evening walk — memory only until Save
  eveningSettings: { time: DEFAULT_REMINDER, notify: false, ...readJSON(EVENING_KEYS.settings, {}) },
  morning: null, // the intention being picked — memory only until Save
  morningSettings: { time: DEFAULT_MORNING_REMINDER, ...readJSON(MORNING_KEYS.settings, {}) },
  calendarChips: [] // titles read from a picked .ics file — memory only, never stored
};

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function readJSON(key, fallback) { try { return JSON.parse(safeGet(key)) || fallback; } catch { return fallback; } }
function storageAvailable() { try { localStorage.setItem("pops.probe", "1"); localStorage.removeItem("pops.probe"); return true; } catch { return false; } }

function persist(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch { showToast("Couldn’t save — this browser blocked local storage."); return false; }
}
function persistJournal() { return persist(STORAGE_KEYS.journal, JSON.stringify(state.journal)); }

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
}

const ICONS = {
  current: '<path d="M12 3v2m0 14v2M3 12h2m14 0h2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4M7.7 16.3l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
  attend: '<path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/><path d="m9 14 2 2 4-4"/>',
  relate: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="8" r="2"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M15 13c3 0 5 2 5 5"/>',
  pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6m4-6v6"/>',
  reflect: '<path d="M12 3a8 8 0 1 0 8 8"/><path d="M12 7v5l3 2M16 3h5v5"/>',
  journal: '<path d="M5 3h13a1 1 0 0 1 1 1v17H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 7h7M8 11h7M8 15h4"/>',
  next: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`; }

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function header(title, subtitle = "", { back = "home", right = "" } = {}) {
  return `<header class="screen-header">
    <button class="icon-button" data-action="${back}" aria-label="Back">${icon("back")}</button>
    <div class="header-text"><p class="eyebrow">POPS</p><h1>${escapeHTML(title)}</h1>${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}</div>
    ${right || `<button class="icon-button" data-action="settings" aria-label="Change this section">${icon("settings")}</button>`}
  </header>`;
}

const helpLink = `<button class="help-link" data-action="crisis-direct">${icon("heart")} Need help right now?</button>`;

// --------------------------------------------------------------------------- Home
function renderHome() {
  app.innerHTML = `<section class="home-screen">
    <header class="brand-center"><p class="eyebrow">Pause · Observe · Probe · Select</p><h1>POPS</h1></header>
    ${eveningBanner()}
    ${focusCard()}
    ${state.mantraSheet ? mantraSheet(mantraPick()) : ""}${state.focusSheet ? focusSheet() : ""}
    <div class="action-grid" aria-label="POPS sections">
      ${tile("attend", "Attend", true)}${tile("relate", "Relate", true)}
      ${tile("pause", "Pause", false, state.session && !isComplete(state.session) ? "Resume reflection" : "Bring a real choice")}${tile("reflect", "Reflect", true)}
    </div>
    <span id="later-note" class="sr-only">Coming later</span>
    ${eveningHomeCard()}
    ${setupHomeCard()}
    <p class="privacy-line">${icon("lock")} Nothing leaves this device. No account, no AI model, no server. Only what you choose to Save is kept, in this browser.</p>
    ${state.storageOk ? "" : '<p class="warning">This browser is blocking local storage (private mode?). Reflections work, but Journal saves won’t stick.</p>'}
    ${helpLink}
    <p class="version">Beta ${APP_VERSION}</p>
  </section>`;
}

function tile(name, label, disabled, caption = "") {
  return `<button class="action-tile ${disabled ? "disabled" : "live"}" ${disabled ? 'disabled aria-describedby="later-note"' : `data-action="${name}"`}>
    ${icon(name)}<strong>${label}</strong>${disabled ? "<small>Coming later</small>" : `<small>${escapeHTML(caption)}</small>`}
  </button>`;
}

// --------------------------------------------------------------------------- About
function renderAbout() {
  app.innerHTML = `<section>${header("About POPS", "A companion for the moment before a consequential choice.")}
    <div class="card prose">
      <p class="lead">I’m POPS: Pause, Observe, Probe, Select. I don’t have a hidden answer. I help you see clearly enough to own the next choice.</p>
      <p><strong>Pause</strong> interrupts autopilot. <strong>Observe</strong> turns toward what’s real and who’s affected. <strong>Probe</strong> tests assumptions, alternatives, and consequences. <strong>Select</strong> returns the choice to you — the person who has to live it.</p>
    </div>
    <h2 class="section-title">VALUE, inside the rhythm</h2>
    <div class="card"><dl class="lens-list">${VALUE_LENS.map(l => `<div><dt>${l.label}</dt><dd>${escapeHTML(l.definition)}</dd></div>`).join("")}</dl>
      <p class="field-note">A repeating lens — not a score, not a persuasion engine.</p></div>
    <h2 class="section-title">What POPS will never be</h2>
    <div class="card"><ul class="never-list"><li>A ruler, oracle, parent, or judge</li><li>A therapist-by-stealth, persuasion engine, or sales closer</li><li>A surveillance system or engagement machine</li><li>A replacement for accountable expertise or a crisis service</li></ul></div>
    <h2 class="section-title">Memory, honestly</h2>
    <div class="card prose"><p>POPS remembers only what you explicitly Save to the Journal — a decision card, never a transcript. An unsaved reflection disappears when you leave or close the app. Deleting is real. Please don’t type passwords or other secrets.</p>
      <p>This beta stores the Journal in this browser’s local storage. It is not encrypted and is not synced or backed up. Clearing site data erases it.</p></div>
    <h2 class="section-title">AI assist</h2>
    <div class="card prose"><p>Off. This beta contains no AI model and makes no network requests with your words. A future, opt-in assist is described in the project docs and will never become the chooser.</p></div>
    <button class="primary" data-action="pause">Bring a real choice</button>
    ${helpLink}
  </section>`;
}

// --------------------------------------------------------------------------- Current
function renderCurrent() {
  app.innerHTML = `<section>${header("Current", "Name the focus environment you’re in.")}
    <div class="card conversation"><p class="question">What do you want Current to hold right now?</p>
      <div class="choice-list">${["Personal time", "Work", "With people", "Make your own"].map(v => `<button data-current="${v}">${v}</button>`).join("")}</div>
      <form id="current-form" class="free-form hidden"><label for="current-input">Make your own</label><input id="current-input" maxlength="60" autocomplete="off" /><button class="primary">Save Current</button></form>
    </div></section>`;
}

// --------------------------------------------------------------------------- Reflection
function renderStart() {
  app.innerHTML = `<section>${header("Pause", "A guided offline reflection — not an AI judgment.")}
    <div class="card conversation">
      <p class="question">How much room do you have right now?</p>
      <p class="help">One question at a time. You can skip, go back, stop, or answer in your own words at every step. Nothing is saved unless you tap Save at the end.</p>
      <div class="choice-list depth-list">${Object.entries(DEPTHS).map(([key, d]) => `<button data-depth="${key}"><strong>${d.label}</strong><span>${d.description}</span></button>`).join("")}</div>
    </div>
    ${helpLink}</section>`;
}

function renderFlow() {
  const session = state.session;
  if (isComplete(session)) return renderCard();
  const beats = beatsFor(session.depth);
  const beat = beats[session.index];
  const stageIndex = POPS_STAGES.indexOf(beat.stage);
  const existing = session.answers[beat.field];
  let body = "";
  if (beat.kind === "options") body = optionsBody(beat);
  else if (beat.kind === "select") body = selectBody(beat, existing);
  else body = choiceBody(beat, existing);
  app.innerHTML = `<section>${header("Pause", state.session.depth === "quick" ? "Quick reflection" : "Full reflection", { back: "stop-flow" })}
    <div class="stage-track" aria-label="Stage ${stageIndex + 1} of 4: ${beat.stage}">${POPS_STAGES.map((s, i) => `<span class="${i === stageIndex ? "active" : i < stageIndex ? "done" : ""}">${s}</span>`).join("")}</div>
    <div class="progress" aria-hidden="true"><span style="width:${Math.round((session.index / beats.length) * 100)}%"></span></div>
    <div class="card conversation" data-beat="${beat.id}">
      ${beat.lens ? `<p class="lens-chip" title="${escapeHTML(VALUE_LENS.find(l => l.label === beat.lens)?.definition || "")}">VALUE · ${beat.lens}</p>` : ""}
      <p class="question" id="q">${escapeHTML(beat.prompt)}</p>
      ${beat.help ? `<p class="help">${escapeHTML(beat.help)}</p>` : ""}
      ${session.professionalNoted && !state.profShown ? `<p class="notice">${escapeHTML(PROFESSIONAL_NOTE)}</p>` : ""}
      ${body}
      <div class="escape-row">
        <button data-action="back-step" ${session.index === 0 ? "disabled" : ""}>Go back</button>
        <button data-action="skip-step">Skip</button>
        <button data-action="stop-flow">Stop</button>
      </div>
    </div>
    <p class="step-count">Question ${session.index + 1} of ${beats.length}${state.returnTo === "card" ? " · editing" : ""}</p>
    ${helpLink}
  </section>`;
  if (session.professionalNoted) state.profShown = true;
}

function choiceBody(beat, existing) {
  const isText = beat.kind === "text";
  const open = isText || state.customAnswer;
  return `${beat.choices?.length ? `<div class="choice-list">${beat.choices.map(c => `<button data-answer="${escapeHTML(c)}" class="${existing === c ? "chosen" : ""}">${escapeHTML(c)}</button>`).join("")}</div>` : ""}
    ${isText ? "" : '<button class="rather" data-action="rather">I’d rather…</button>'}
    <form id="answer-form" class="free-form ${open ? "" : "hidden"}">
      <label for="answer-input">${isText ? "In your own words" : "Say it your way"}</label>
      <textarea id="answer-input" maxlength="1000" rows="${isText ? 4 : 3}" placeholder="${escapeHTML(beat.placeholder || "")}">${escapeHTML(existing && !(beat.choices || []).includes(existing) ? existing : "")}</textarea>
      <button class="primary">Continue</button>
    </form>`;
}

function optionsBody() {
  const list = state.draftAlternatives;
  return `<ul class="alt-list">${list.map((alt, i) => `<li><span>${escapeHTML(alt)}</span><button class="remove" data-remove-alt="${i}" aria-label="Remove ${escapeHTML(alt)}">${icon("close")}</button></li>`).join("")}
      <li class="fixed"><span>Wait and revisit later</span><small>always included</small></li>
      <li class="fixed"><span>Take no action for now</span><small>always included</small></li></ul>
    <form id="alt-form" class="inline-form ${list.length >= MAX_ALTERNATIVES ? "hidden" : ""}">
      <label for="alt-input" class="sr-only">Add a path</label>
      <input id="alt-input" maxlength="160" autocomplete="off" placeholder="Add a path in your words" />
      <button class="add" aria-label="Add path">${icon("plus")}</button>
    </form>
    <button class="primary" data-action="alts-done">${list.length ? "These are my paths" : "Continue with just these"}</button>`;
}

function selectBody(beat, existing) {
  const options = selectOptions(state.session.answers);
  return `<div class="choice-list">${options.map(o => `<button data-answer="${escapeHTML(o)}" class="${existing === o ? "chosen" : ""}">${escapeHTML(o)}</button>`).join("")}</div>
    <button class="rather" data-action="rather">I’d rather…</button>
    <form id="answer-form" class="free-form ${state.customAnswer ? "" : "hidden"}"><label for="answer-input">Name your own path</label><textarea id="answer-input" maxlength="1000" rows="3"></textarea><button class="primary">This is my choice</button></form>`;
}

function renderCard() {
  const card = buildCard(state.session);
  const saved = state.savedSessionId === state.session.id;
  app.innerHTML = `<section>${header("Your decision card", "Review it. Edit anything. Then decide whether to keep it.", { back: "stop-flow" })}
    <div class="card completion">
      <div class="soft-mark">✓</div>
      <h2>The choice stays yours.</h2>
      <p class="handback">${escapeHTML(card.handback)}</p>
      ${cardFields(card, true)}
      <p class="field-note">${saved ? "A copy of this card is in your Journal." : "Nothing from this reflection has been saved. If you leave now, it’s gone."}</p>
      ${saved ? '<button class="primary" data-action="journal">Open Journal</button>' : '<button class="primary" data-action="save-card">Save card to Journal</button>'}
      <button class="secondary" data-action="finish">${saved ? "Done" : "Done without saving"}</button>
    </div>${helpLink}</section>`;
}

function cardFields(card, editable) {
  return `<dl class="card-fields">${CARD_FIELDS.map(([key, label]) => {
    const raw = card[key];
    const value = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const inFlow = beatsFor(card.depth).some(b => b.field === key);
    if (!value.length && !inFlow) return "";
    return `<div class="${key === "selection" ? "highlight" : ""}"><dt>${label}${editable && inFlow ? ` <button class="edit-link" data-edit="${key}">Edit</button>` : ""}</dt>
      <dd>${value.length ? (value.length > 1 ? `<ul>${value.map(v => `<li>${escapeHTML(v)}</li>`).join("")}</ul>` : escapeHTML(value[0])) : '<span class="muted">Skipped</span>'}</dd></div>`;
  }).join("")}</dl>`;
}

// --------------------------------------------------------------------------- Crisis
function renderCrisis() {
  app.innerHTML = `<section class="crisis">
    <div class="card crisis-card" role="alertdialog" aria-labelledby="crisis-title" aria-describedby="crisis-body">
      <p class="eyebrow">POPS · safety</p>
      <h1 id="crisis-title">${escapeHTML(CRISIS_MESSAGE.title)}</h1>
      <p id="crisis-body">${escapeHTML(CRISIS_MESSAGE.body)}</p>
      <div class="crisis-actions">
        <a class="primary call" href="tel:988">Call 988 — Suicide &amp; Crisis Lifeline</a>
        <a class="secondary" href="sms:988">Text 988</a>
        <a class="secondary" href="https://988lifeline.org/chat/" target="_blank" rel="noopener noreferrer">Chat at 988lifeline.org</a>
        <a class="secondary" href="tel:911">In immediate danger? Call 911</a>
      </div>
      <p class="field-note">988 serves the US. Outside the US, call your local emergency number. ${state.crisisFrom === "input" || state.crisisFrom === "evening" ? escapeHTML(CRISIS_MESSAGE.notStored) : ""}</p>
      <div class="crisis-resume">
        ${state.session && !isComplete(state.session) && state.crisisFrom === "input" ? '<button data-action="crisis-resume">I’m safe right now — continue the reflection</button>' : ""}
        ${state.crisisFrom === "direct" && state.session ? '<button data-action="crisis-resume">I’m okay — go back</button>' : ""}
        ${state.crisisFrom === "morning" ? '<button data-mo="open-keep">I’m safe right now — go back</button>' : ""}
        ${state.evening && state.crisisFrom === "evening" ? '<button data-eva="resume">I’m safe right now — continue the reflection</button>' : ""}
        <button data-action="crisis-end">End and return home</button>
      </div>
    </div></section>`;
}

// --------------------------------------------------------------------------- Journal
function renderJournal() {
  const entry = state.journal.find(e => e.id === state.openEntryId);
  app.innerHTML = `<section>${header("Journal", "Only what you chose to keep, stored in this browser.")}
    <nav class="journal-tools" aria-label="Journal actions">
      ${journalTool("Add", "＋", false)}${journalTool("Read", "▤", false)}${journalTool("Hear", "◉", true)}
      ${journalTool("Examine", "⌕", true)}${journalTool("Understand", "◇", true)}${journalTool("Reflect", "↺", true)}
    </nav>
    ${state.journalMode === "add" ? journalAdd() : journalRead()}
    ${entry ? entryPanel(entry) : ""}
  </section>`;
}

function journalTool(label, symbol, disabled) {
  const active = state.journalMode === label.toLowerCase();
  return `<button ${disabled ? "disabled" : `data-journal-mode="${label.toLowerCase()}"`} class="${active ? "active" : ""}"><b>${symbol}</b><span>${label}</span>${disabled ? "<small>Later</small>" : ""}</button>`;
}

function journalAdd() {
  return `<div class="card"><form id="journal-form"><label for="journal-text">What do you choose to keep?</label>
    <textarea id="journal-text" rows="8" maxlength="2000" placeholder="Your exact words will be preserved as the source."></textarea>
    <p class="field-note">Saving this entry does not authorize POPS to infer or store anything else.</p><button class="primary">Save on this device</button></form></div>`;
}

function journalRead() {
  if (!state.journal.length) return `<div class="card empty"><p>No Journal entries yet.</p><p class="field-note">Finish a Pause and tap Save, or add a note in your own words.</p><button class="primary" data-journal-mode="add">Add your first entry</button></div>`;
  return `<div class="entry-list">${state.journal.map(e => `<article class="card entry">
      <div class="entry-meta"><span class="kind ${e.kind}">${e.kind === "decision" ? "Decision card" : e.kind === "reflection" ? "Evening reflection" : e.kind === "morning" ? "Morning check-in" : e.kind === "mantra" ? (e.comment ? "Mantra · your note" : "Mantra") : "Note"}</span><time>${formatDate(e.createdAt)}</time></div>
      ${e.kind === "mantra" ? `<h3>${escapeHTML(e.line)}</h3>${e.comment ? `<p>${escapeHTML(e.comment)}</p>` : ""}${e.reason ? `<p class="field-note">${escapeHTML(e.reason)}</p>` : ""}` : e.kind === "morning" ? `<h3>${escapeHTML(e.intention || `Arriving: ${e.mood}`)}</h3>${e.mood && e.intention ? `<p class="field-note">Arriving: ${escapeHTML(e.mood)}</p>` : ""}<p>${escapeHTML(e.line)}</p>` : e.kind === "reflection" ? `<h3>${escapeHTML(e.question)}</h3><p>${escapeHTML(e.answers.reflect || e.answers.answer || e.answers.observe || e.answers.probe || "Kept")}</p>` : e.kind === "decision" ? `<h3>${escapeHTML(e.title)}</h3><p>${e.card.selection ? `<strong>Your choice:</strong> ${escapeHTML(e.card.selection)}` : "No path named"}</p>` : `<p>${escapeHTML(e.originalText)}</p>`}
      <div><button data-open="${e.id}">${e.kind === "decision" ? "Open card" : e.kind === "reflection" ? "Open reflection" : "View source"}</button><button class="danger" data-delete="${e.id}">${icon("trash")} Delete</button></div>
    </article>`).join("")}</div>
    <div class="journal-footer"><button data-action="export">Download a copy (JSON)</button><button class="danger-text" data-action="delete-all">Delete everything</button></div>`;
}

function entryPanel(entry) {
  return `<div class="modal-backdrop" data-action="close-entry"><article class="source-panel" role="dialog" aria-modal="true" aria-labelledby="entry-title" data-panel>
    <p class="eyebrow">${entry.kind === "decision" ? "Saved decision card" : entry.kind === "reflection" ? `Evening reflection · ${escapeHTML(entry.day || "")}` : entry.kind === "mantra" ? `Mantra · ${escapeHTML(entry.day || "")}` : entry.kind === "morning" ? `Morning check-in · ${escapeHTML(entry.day || "")}` : "Narrative → source"}</p>
    <h2 id="entry-title">${escapeHTML(entry.kind === "decision" ? entry.title : entry.kind === "reflection" ? "Your evening, in your words" : entry.kind === "morning" ? "A decision to handle well" : "Original entry")}</h2>
    ${entry.kind === "decision" ? `<p class="handback">${escapeHTML(entry.card.handback)}</p>${cardFields(entry.card, false)}` : `<blockquote>${escapeHTML(entry.originalText)}</blockquote>`}
    <dl class="meta"><div><dt>Source</dt><dd>${escapeHTML(entry.source)}</dd></div><div><dt>Saved</dt><dd>${escapeHTML(formatDate(entry.createdAt, true))}</dd></div></dl>
    <p class="field-note">No transcript was kept. No inferred relationship or meaning has been saved as fact.</p>
    <button class="primary" data-action="close-entry">Done</button></article></div>`;
}

// --------------------------------------------------------------------------- Next & Settings
function renderNext() {
  app.innerHTML = `<section>${header("Next", "Choose whether this beta should remember a timing preference.")}
    <div class="card conversation"><p class="question">Nudges?</p><div class="choice-list">
      <button data-nudge="yes">Yes</button><button data-nudge="no">No</button><button data-nudge="custom">Custom</button></div>
      <form id="nudge-form" class="free-form hidden"><label for="nudge-custom">What timing works for you?</label><input id="nudge-custom" maxlength="60" placeholder="For example: 20 minutes before" /><button class="primary">Save preference</button></form>
      <div id="timing-choices" class="free-form hidden"><p>How much warning would feel useful?</p><div class="choice-list"><button data-minutes="10">10 minutes</button><button data-minutes="5">5 minutes</button><button data-nudge="custom">Custom</button></div></div>
      <p class="limit-note"><strong>Beta limit:</strong> this saves a preference only. It does not schedule notifications or read your calendar.</p>
    </div></section>`;
}

function renderSettings() {
  app.innerHTML = `<section>${header("Change this section", "", { back: "settings-back" })}
    <div class="card conversation"><p class="question">What would you like POPS to do differently here?</p>
      <p class="help">Beta feedback. It stays on this device. Nothing is sent anywhere — if you want it kept, save it as a Journal note and share it with the team yourself.</p>
      <form id="feedback-form" class="free-form"><label for="feedback">Your note</label><textarea id="feedback" rows="5" maxlength="2000"></textarea>
        <button class="primary">Save as a Journal note</button></form>
      <button class="plain-link" data-action="settings-back">Never mind</button>
    </div></section>`;
}

function formatDate(value, full = false) {
  return new Intl.DateTimeFormat(undefined, full ? { dateStyle: "full", timeStyle: "long" } : { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const VIEWS = { settings: renderSettings, home: renderHome, about: renderAbout, current: renderCurrent, start: renderStart, flow: renderFlow, crisis: renderCrisis, journal: renderJournal, next: renderNext, evening: renderEvening, setup: renderSetup, reminders: renderSetup, morning: renderMorning };
function render(focus = true) {
  (VIEWS[state.view] || renderHome)();
  if (focus) {
    window.scrollTo({ top: 0 });
    const target = app.querySelector(".question, h1");
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
  }
}

// --------------------------------------------------------------------------- Actions
function go(view) { state.view = view; state.focusSheet = false; state.mantraSheet = null; state.customAnswer = false; render(); }

function startFlow(depth) {
  state.session = createSession(depth);
  state.draftAlternatives = [];
  state.returnTo = null;
  state.profShown = false;
  state.savedSessionId = null;
  go("flow");
}

function submitAnswer(value) {
  try {
    const { session, safety } = answerBeat(state.session, value, { returnTo: state.returnTo });
    if (safety.level === "crisis") { state.crisisFrom = "input"; go("crisis"); return; }
    state.session = session;
    if (state.returnTo === "card") state.returnTo = null;
    if (safety.level === "professional") state.profShown = false;
    syncDraftAlternatives();
    go("flow");
  } catch (error) { showToast(error.message); }
}

function syncDraftAlternatives() {
  const beat = beatsFor(state.session.depth)[state.session.index];
  if (beat?.kind === "options") state.draftAlternatives = [...(state.session.answers.alternatives || [])];
}

function confirmLeaveFlow() {
  if (!state.session || state.savedSessionId === state.session.id) return true;
  const hasAnswers = Object.keys(state.session.answers).length > 0;
  return !hasAnswers || confirm("Stop this reflection? Nothing has been saved, so your answers will be gone.");
}

app.addEventListener("click", event => {
  const target = event.target.closest("button, [data-action]");
  if (!target || target.disabled) return;
  if (target.matches(".modal-backdrop") && event.target.closest("[data-panel]")) return; // clicks inside the panel
  const action = target.dataset.action;

  switch (action) {
    case "home": return go("home");
    case "about": return go("about");
    case "current": return go("current");
    case "journal": state.journalMode = "read"; state.openEntryId = null; return go("journal");
    case "next": return go("next");
    case "settings": state.settingsFrom = state.view; return go("settings");
    case "settings-back": return go(state.settingsFrom === "flow" && state.session ? "flow" : state.settingsFrom || "home");
    case "pause":
      if (state.session && !isComplete(state.session)) return go("flow");
      return go("start");
    case "rather": state.customAnswer = true; render(false); document.querySelector("#answer-input")?.focus(); return;
    case "back-step":
      state.session = goBack(state.session); state.returnTo = null; syncDraftAlternatives(); return go("flow");
    case "skip-step":
      state.session = skipBeat(state.session, { returnTo: state.returnTo }); state.returnTo = null; syncDraftAlternatives(); return go("flow");
    case "stop-flow":
      if (!confirmLeaveFlow()) return;
      state.session = null; state.returnTo = null; return go("home");
    case "finish":
      if (!confirmLeaveFlow()) return;
      state.session = null; return go("home");
    case "alts-done": return submitAnswer(state.draftAlternatives);
    case "save-card": {
      if (!state.storageOk) return showToast("This browser is blocking storage, so the card can’t be saved.");
      const entry = createDecisionEntry(buildCard(state.session));
      state.journal.unshift(entry);
      if (persistJournal()) { state.savedSessionId = state.session.id; render(false); showToast("Saved to Journal on this device"); }
      else state.journal.shift();
      return;
    }
    case "crisis-direct": state.crisisFrom = "direct"; state.returnView = state.view; return go("crisis");
    case "crisis-resume": return go(state.crisisFrom === "direct" ? (state.returnView || "home") : "flow");
    case "crisis-end": state.session = null; state.evening = null; clearEveningLink(); state.returnTo = null; return go("home");
    case "close-entry": state.openEntryId = null; return render(false);
    case "export": return exportFile();
    case "delete-all":
      if (confirm("Delete every Journal entry from this browser? This cannot be undone.")) { state.journal = []; persistJournal(); render(false); showToast("Journal erased from this browser"); }
      return;
  }

  const d = target.dataset;
  if (d.depth) return startFlow(d.depth);
  if (d.answer) return submitAnswer(d.answer);
  if (d.edit) { state.session = jumpTo(state.session, d.edit); state.returnTo = "card"; syncDraftAlternatives(); return go("flow"); }
  if (d.removeAlt) { state.draftAlternatives.splice(Number(d.removeAlt), 1); return render(false); }
  if (d.current) {
    if (d.current === "Make your own") { document.querySelector("#current-form").classList.remove("hidden"); document.querySelector("#current-input").focus(); }
    else { state.current = d.current; persist(STORAGE_KEYS.current, state.current); go("home"); }
    return;
  }
  if (d.journalMode) { state.journalMode = d.journalMode; return render(false); }
  if (d.open) { state.openEntryId = d.open; return render(false); }
  if (d.delete) {
    if (confirm("Delete this Journal entry from this browser? This cannot be undone.")) { state.journal = state.journal.filter(e => e.id !== d.delete); persistJournal(); render(false); showToast("Journal entry deleted"); }
    return;
  }
  if (d.nudge === "no") { state.nudges = { mode: "no" }; persist(STORAGE_KEYS.nudges, JSON.stringify(state.nudges)); return go("home"); }
  if (d.nudge === "yes") return document.querySelector("#timing-choices").classList.remove("hidden");
  if (d.nudge === "custom") { document.querySelector("#nudge-form").classList.remove("hidden"); document.querySelector("#nudge-custom").focus(); return; }
  if (d.minutes) { state.nudges = { mode: "yes", minutes: Number(d.minutes) }; persist(STORAGE_KEYS.nudges, JSON.stringify(state.nudges)); go("home"); showToast("Timing preference saved — no notification scheduled"); }
});

app.addEventListener("submit", event => {
  event.preventDefault();
  const id = event.target.id;
  if (id === "answer-form") return submitAnswer(document.querySelector("#answer-input").value);
  if (id === "alt-form") {
    const input = document.querySelector("#alt-input");
    const value = cleanText(input.value, 160);
    if (!value) return;
    if (assessSafety(value).level === "crisis") { state.crisisFrom = "input"; return go("crisis"); }
    if (!state.draftAlternatives.some(a => a.toLowerCase() === value.toLowerCase())) state.draftAlternatives.push(value);
    render(false); document.querySelector("#alt-input")?.focus(); return;
  }
  if (id === "current-form") { const v = cleanText(document.querySelector("#current-input").value, 60); if (v) { state.current = v; persist(STORAGE_KEYS.current, v); go("home"); } return; }
  if (id === "journal-form") {
    try {
      const text = document.querySelector("#journal-text").value;
      if (assessSafety(text).level === "crisis") { state.crisisFrom = "input"; return go("crisis"); }
      state.journal.unshift(createJournalEntry(text));
      if (persistJournal()) { state.journalMode = "read"; render(false); showToast("Saved on this device"); } else state.journal.shift();
    } catch (error) { showToast(error.message); }
    return;
  }
  if (id === "feedback-form") {
    const text = cleanText(document.querySelector("#feedback").value);
    if (!text) return showToast("Add a few words first.");
    if (assessSafety(text).level === "crisis") { state.crisisFrom = "input"; return go("crisis"); }
    state.journal.unshift({ ...createJournalEntry(`Beta feedback (${state.settingsFrom || "home"}): ${text}`), source: "Typed by you on this device (feedback)" });
    if (persistJournal()) { go(state.settingsFrom === "flow" && state.session ? "flow" : state.settingsFrom || "home"); showToast("Saved as a Journal note — not sent anywhere"); } else state.journal.shift();
    return;
  }
  if (id === "nudge-form") { const custom = cleanText(document.querySelector("#nudge-custom").value, 60); if (custom) { state.nudges = { mode: "custom", custom }; persist(STORAGE_KEYS.nudges, JSON.stringify(state.nudges)); go("home"); showToast("Preference saved — no notification scheduled"); } }
});

function exportFile() {
  const blob = new Blob([exportJournal(state.journal)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `pops-journal-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Downloaded to this device — not uploaded anywhere");
}

// Warn before closing the tab mid-reflection (unsaved answers live only in memory).
window.addEventListener("beforeunload", event => {
  if (state.session && state.savedSessionId !== state.session.id && Object.keys(state.session.answers).length) { event.preventDefault(); event.returnValue = ""; }
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

// =========================================================================== Evening reflection (POPR)
// Pause · Observe · Probe · Reflect. The walk lives in memory only; nothing is written until Save.
const EV_STEPS = ["question", "pause", "observe", "people", "probe", "reflect", "review"];
const EV_STAGE = { question: 0, pause: 0, observe: 1, people: 1, probe: 2, reflect: 3, review: 3 };

function eveningStats() { return reflectionStats(state.journal); }
function eveningLink() { return `${location.origin}${location.pathname}?open=evening#evening`; }
function clearEveningLink() {
  if (location.hash === "#evening" || /[?&]open=evening/.test(location.search)) history.replaceState(null, "", location.pathname);
}

function eveningBanner() {
  const due = reminderDue(new Date(), state.eveningSettings.time, eveningStats().doneToday);
  return due ? `<div class="ev-banner" role="status">${icon("moon")}<p>Tonight’s question is ready — no pressure.</p><button data-eva="open">Open</button></div>` : "";
}

// --------------------------------------------------------------------------- Morning
function morningLink() { return `${location.origin}${location.pathname}?open=morning#morning`; }
function saveMorningSettings() { persist(MORNING_KEYS.settings, JSON.stringify(state.morningSettings)); }
function mantraPick() {
  const focus = state.current === "Choose your focus" ? "" : state.current;
  return selectMantra({ mood: morningMoodFor(state.journal), intention: morningIntentionFor(state.journal), events: state.calendarChips, focus, hidden: hiddenMantras() }, state.mantraOffset || 0);
}
function mantra() { return mantraPick().text; }
function hiddenMantras() { try { return JSON.parse(localStorage.getItem(MANTRA_HIDDEN_KEY) || "[]"); } catch { return []; } }
function mantraSheet(m) {
  const s = state.mantraSheet;
  return `<div class="sheet-backdrop" data-ms="close"></div><div class="mantra-sheet bottom-sheet" role="dialog" aria-modal="true" aria-label="Today’s mantra">
    <div class="sheet-grip"></div><p class="ms-quote">${escapeHTML(m.text)}</p>
    <div class="ms-actions">
      <button class="secondary" data-ms="log">Log it</button>
      <button class="secondary" data-ms="comment" aria-expanded="${s.commenting}">Comment</button>
      <button class="secondary" data-ms="new">New one${m.pool > 1 ? "" : ""}</button>
    </div>
    ${s.commenting ? `<form id="ms-form" class="ms-form">
      <div class="chip-row">${MANTRA_COMMENT_CHIPS.map(c => `<button type="button" class="chip ${s.chip === c ? "on" : ""}" data-ms-chip="${escapeHTML(c)}" aria-pressed="${s.chip === c}">${escapeHTML(c)}</button>`).join("")}</div>
      <label for="ms-input" class="sr-only">Your comment</label><input id="ms-input" maxlength="300" autocomplete="off" placeholder="Write your own" value="${escapeHTML(s.draft || "")}" />
      <button class="primary">Save</button></form>` : ""}
    <div class="ms-foot"><button class="plain-link" data-ms="hide">Not for me</button><button class="plain-link" data-ms="close">Close</button></div>
  </div>`;
}
function saveMantra(comment) {
  if (!state.storageOk) return showToast("This browser is blocking storage, so this can’t be saved.");
  const m = mantraPick();
  try {
    const entry = createMantraEntry({ text: m.text, reason: m.reason, comment });
    state.journal.unshift(entry);
    if (!persistJournal()) { state.journal.shift(); return; }
    state.mantraSheet = null; render(false); showToast(comment ? "Mantra and your note kept in your Journal" : "Mantra logged in your Journal");
  } catch (error) {
    if (error.message === "crisis") { state.mantraSheet = null; state.crisisFrom = "home"; return go("crisis"); }
    showToast(error.message);
  }
}
// One top card: a quiet daily mantra (tap for another), the current focus, then today's intention.
function focusCard() {
  const intention = morningIntentionFor(state.journal), mood = morningMoodFor(state.journal);
  const m = mantraPick();
  const focus = state.current === "Choose your focus" ? "Not set" : state.current;
  return `<article class="focus-card" aria-label="Today’s mantra and your focus">
    <button class="mantra" data-mo="sheet" aria-haspopup="dialog" aria-label="Today’s mantra — log it, comment, or see another"><span class="mantra-text">${escapeHTML(m.text)}</span>${m.reason ? `<em class="mantra-why">${escapeHTML(m.reason)}</em>` : ""}</button>
    ${intention || mood ? `<p class="mo-kept">${mood ? `Arriving ${escapeHTML(mood.toLowerCase())}` : ""}${mood && intention ? " · " : ""}${intention ? `Today I want to handle well: <strong>${escapeHTML(intention)}</strong>` : ""}</p>` : '<button class="mo-open" data-mo="open">+ Morning check-in: mood & a decision to handle well</button>'}
    <button class="fn-button" data-fs="open" aria-haspopup="dialog">${icon("next")}<span><strong>Focus / Nudge</strong><small>Focus · ${escapeHTML(focus)} · ${escapeHTML(nudgeSummary(state.nudges))}</small></span></button>
  </article>`;
}
function focusSheet() {
  const custom = !["Personal time", "Work", "With people", "Choose your focus"].includes(state.current);
  return `<div class="sheet-backdrop" data-fs="close"></div><div class="bottom-sheet focus-sheet" role="dialog" aria-modal="true" aria-label="Focus and nudge">
    <div class="sheet-grip"></div>
    <p class="sheet-title">Focus</p>
    <div class="choice-list">${["Personal time", "Work", "With people", "Make your own"].map(v => `<button data-current="${v}" aria-pressed="${state.current === v || (v === "Make your own" && custom)}" class="${state.current === v || (v === "Make your own" && custom) ? "on" : ""}">${v === "Make your own" && custom ? `Make your own · ${escapeHTML(state.current)}` : v}</button>`).join("")}</div>
    <form id="current-form" class="free-form hidden"><label for="current-input">Make your own</label><input id="current-input" maxlength="60" autocomplete="off" /><button class="primary">Save focus</button></form>
    <p class="sheet-title">Next up · nudges</p>
    <button class="fn-row" data-action="next"><span><strong>Likely interruption or obligation</strong><small>${escapeHTML(nudgeSummary(state.nudges))} · tap to change</small></span>${icon("next")}</button>
    <button class="plain-link sheet-close" data-fs="close">Close</button>
  </div>`;
}
function renderMorning() {
  const m = state.morning || (state.morning = { pick: "", mood: "" });
  app.innerHTML = `<section>${header("This morning", "", { back: "home", right: " " })}
    <div class="card conversation" data-mo-step="intention">
      <p class="mo-line big">${escapeHTML(mantra())}</p>
      <p class="question small-q">${escapeHTML(MOOD_PROMPT)}</p>
      <div class="chip-row">${MORNING_MOODS.map(c => `<button class="chip ${m.mood === c ? "on" : ""}" data-mo-mood="${escapeHTML(c)}" aria-pressed="${m.mood === c}">${escapeHTML(c)}</button>`).join("")}</div>
      <p class="question small-q" id="q">${escapeHTML(INTENTION_PROMPT)}</p>
      <div class="chip-row">${INTENTION_CHIPS.map(c => `<button class="chip ${m.pick === c ? "on" : ""}" data-mo-chip="${escapeHTML(c)}" aria-pressed="${m.pick === c}">${escapeHTML(c)}</button>`).join("")}</div>
      <form id="mo-form" class="free-form"><label for="mo-input" class="sr-only">Write your own</label>
        <input id="mo-input" maxlength="300" autocomplete="off" placeholder="Write your own (mood or decision)" value="${escapeHTML(INTENTION_CHIPS.includes(m.pick) ? "" : m.pick)}" />
        <button class="primary">Save</button></form>
      <div class="escape-row"><button data-mo="later">Not today</button></div>
    </div>
    <p class="step-count">Nothing is saved until you tap Save</p>${helpLink}</section>`;
}
function openMorning() { state.morning = { pick: "", mood: "" }; go("morning"); }
function saveMorning(value) {
  const m = state.morning || { pick: "", mood: "" };
  const typed = value && value !== m.pick ? value : "";
  // Typed text that reads like a mood with no mood chip chosen counts as the mood; otherwise it's the decision.
  const mood = m.mood || (typed && !m.pick && /^(feeling |i feel |i'?m )?\w+( \w+)?$/i.test(typed) && /rush|anx|tired|low|calm|stress|hope|heavy|nerv|worr|good|ok/i.test(typed) ? typed : "");
  const intention = typed && typed !== mood ? typed : m.pick;
  if (!state.storageOk) return showToast("This browser is blocking storage, so this can’t be saved.");
  try {
    state.mantraOffset = 0;
    const entry = createMorningEntry({ line: mantra(), intention, mood });
    state.journal.unshift(entry);
    if (!persistJournal()) { state.journal.shift(); return; }
    state.morning = null; clearMorningLink(); go("home"); showToast("Kept in your Journal on this device");
  } catch (error) {
    if (error.message === "crisis") { state.crisisFrom = "morning"; return go("crisis"); }
    showToast(error.message);
  }
}
function clearMorningLink() { if (/morning/.test(location.search + location.hash)) history.replaceState(null, "", location.pathname); }
function downloadMorningICS() {
  const ics = buildReminderICS({ time: state.morningSettings.time, url: morningLink(), uid: "pops-morning-inspiration@pops", title: "POPS · This morning", lead: "Today’s line about deciding well is ready." });
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "pops-morning-reminder.ics" });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function eveningHomeCard() {
  const stats = eveningStats();
  const due = reminderDue(new Date(), state.eveningSettings.time, stats.doneToday);
  return `<button class="evening-card" data-eva="open">
      <span>${icon("moon")}<small>Evening · POPR moment</small></span>
      <strong>${stats.doneToday ? "Tonight’s reflection is kept" : "Tonight’s question"}</strong>
      <em>${escapeHTML(statsLine(stats))}</em>
    </button>`;
}

function openEvening() {
  const today = dayKey();
  if (!state.evening || state.evening.date !== today) {
    state.evening = { date: today, question: questionForDate(new Date()).q, chips: questionForDate(new Date()).chips, step: 0, answers: {}, people: [], decisionForming: false, savedId: null, profShown: false };
  }
  go("evening");
}

function routeFromURL(fromHashChange) {
  const wantsEvening = location.hash === "#evening" || new URLSearchParams(location.search).get("open") === "evening";
  if (wantsEvening) return openEvening();
  if (location.hash === "#morning" || new URLSearchParams(location.search).get("open") === "morning") return openMorning();
  if (!fromHashChange) render(false);
}

function evStepChips(step, ev) {
  if (step === "question") return ev.chips;
  if (step === "pause") return MOOD_CHIPS;
  if (step === "observe") return OBSERVE_CHIPS;
  if (step === "probe") return evProbe(ev).chips;
  if (step === "reflect") return REFLECT_CHIPS;
  return [];
}

function evProbe(ev) {
  const intention = morningIntentionFor(state.journal);
  if (intention && !/^Nothing big/.test(intention)) return { q: `This morning you wanted to handle “${intention}” well. How did it go?`, chips: ["It went well", "Mixed", "Still open", "It didn’t come up"] };
  return probeFor({ ...ev.answers, people: ev.people });
}

function evPrompt(step, ev) {
  return {
    question: [ev.question, "Tap what fits, or write your own. There’s no right answer."],
    pause: ["Take one slow breath. You’ve arrived at the end of the day.", "Optional: how are you arriving right now?"],
    observe: ["What actually happened today?", "Facts first — what you did, saw, or heard."],
    people: ["Who did you spend time with, or what was on your calendar?", ""],
    probe: [evProbe(ev).q, "One deeper look. Skip it if it doesn’t fit tonight."],
    reflect: ["What are you carrying into tomorrow?", "An intention, a question, or nothing at all."]
  }[step];
}

function renderEvening() {
  const ev = state.evening;
  if (!ev) return openEvening();
  const step = EV_STEPS[ev.step];
  const stage = EV_STAGE[step];
  const track = `<div class="stage-track" aria-label="Stage ${stage + 1} of 4: ${POPR_STAGES[stage]}">${POPR_STAGES.map((s, i) => `<span class="${i === stage ? "active" : i < stage ? "done" : ""}">${s}</span>`).join("")}</div>
    <div class="progress" aria-hidden="true"><span style="width:${Math.round((ev.step / (EV_STEPS.length - 1)) * 100)}%"></span></div>`;
  const head = header("Evening", "A 3–5 minute POPR moment: Pause, Observe, Probe, Reflect.", { back: "ev-stop", right: `<button class="icon-button" data-eva="setup" aria-label="Set up POPS">${icon("settings")}</button>` });
  if (step === "review") return renderEveningReview(head, track);
  const [prompt, help] = evPrompt(step, ev);
  const existing = step === "people" ? "" : ev.answers[step === "question" ? "answer" : step === "pause" ? "mood" : step] || "";
  const chips = evStepChips(step, ev);
  const body = step === "people" ? evPeopleBody(ev) : `<div class="chip-row">${chips.map(c => `<button class="chip ${existing === c ? "on" : ""}" data-ev-chip="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("")}</div>
    <form id="ev-form" class="free-form"><label for="ev-input">Write your own</label>
      <textarea id="ev-input" rows="3" maxlength="1000">${escapeHTML(existing && !chips.includes(existing) ? existing : "")}</textarea>
      <button class="primary">Continue</button></form>`;
  app.innerHTML = `<section>${head}${track}
    <div class="card conversation" data-ev-step="${step}">
      ${step === "question" ? '<p class="lens-chip">Tonight’s question</p>' : ""}
      <p class="question" id="q">${escapeHTML(prompt)}</p>
      ${help ? `<p class="help">${escapeHTML(help)}</p>` : ""}
      ${ev.professional && !ev.profShown ? `<p class="notice">${escapeHTML(PROFESSIONAL_NOTE)}</p>` : ""}
      ${body}
      <div class="escape-row">
        <button data-eva="back" ${ev.step === 0 ? "disabled" : ""}>Go back</button>
        <button data-eva="skip">Skip</button>
        <button data-eva="stop">Stop</button>
      </div>
    </div>
    <p class="step-count">Step ${ev.step + 1} of ${EV_STEPS.length - 1} · nothing is saved until you tap Save</p>
    ${helpLink}</section>`;
  if (ev.professional) ev.profShown = true;
}

function evPeopleBody(ev) {
  const s = state.eveningSettings;
  const known = s.names === false ? [] : knownPeople(state.journal);
  const pool = [...new Set([...ev.people, ...known, ...(s.calendar ? state.calendarChips : [])])];
  const cal = s.calendar
    ? (state.calendarChips.length ? "" : `<label class="pill-button file-button" for="ev-ics">${icon("plus")} Import today’s calendar<input type="file" id="ev-ics" class="sr-only" accept=".ics,text/calendar" /></label>`)
    : `<button class="perm-link" data-eva="setup-from-evening">Calendar · Permission needed</button>`;
  return `${pool.length ? `<div class="chip-row">${pool.map(p => `<button class="chip ${ev.people.includes(p) ? "on" : ""}" data-ev-person="${escapeHTML(p)}" aria-pressed="${ev.people.includes(p)}">${escapeHTML(p)}</button>`).join("")}</div>` : ""}
    <form id="ev-person-form" class="inline-form"><label for="ev-person" class="sr-only">Write your own</label>
      <input id="ev-person" maxlength="80" autocomplete="off" placeholder="Write your own" /><button class="add" aria-label="Add">${icon("plus")}</button></form>
    ${cal}
    <button class="primary" data-eva="people-done">${ev.people.length ? "Continue" : "Continue without names"}</button>`;
}

function evCompositeText(ev) {
  return ["answer", "observe", "probe", "reflect"].map(k => ev.answers[k]).filter(Boolean).join(" · ").slice(0, 1000);
}

function renderEveningReview(head, track) {
  const ev = state.evening;
  const saved = !!ev.savedId;
  const rows = [["Tonight’s question", ev.question], ["Your answer", ev.answers.answer], ["Arriving as", ev.answers.mood], ["What happened", ev.answers.observe],
    ["People & plans", ev.people.join(", ")], [evProbe(ev).q, ev.answers.probe], ["Carrying into tomorrow", ev.answers.reflect]];
  app.innerHTML = `<section>${head}${track}
    <div class="card completion" data-ev-step="review">
      <div class="soft-mark">☾</div>
      <h2>That’s tonight’s pause.</h2>
      <dl class="card-fields">${rows.map(([k, v]) => `<div><dt>${escapeHTML(k)}</dt><dd>${v ? escapeHTML(v) : '<span class="muted">Skipped</span>'}</dd></div>`).join("")}</dl>
      <button class="chip toggle ${ev.decisionForming ? "on" : ""}" data-eva="toggle-decision" aria-pressed="${ev.decisionForming}">${ev.decisionForming ? "✓ " : ""}A decision is forming</button>
      ${ev.decisionForming ? `<div class="bridge"><p class="field-note">Want to give it a proper look? POPS will start with your words from tonight. It still won’t choose for you.</p>
        <div class="bridge-row"><button data-eva="explore-quick">Explore this with POPS · Quick</button><button data-eva="explore-full">Full</button></div></div>` : ""}
      <p class="field-note">${saved ? "Kept in your Journal on this device." : "Nothing from tonight has been saved. If you leave now, it’s gone."}</p>
      ${saved ? '<button class="primary" data-action="journal">Open Journal</button>' : '<button class="primary" data-eva="save">Save to Journal</button>'}
      <button class="secondary" data-eva="done">${saved ? "Done" : "Done without saving"}</button>
    </div>${helpLink}</section>`;
}

function evRecord(value) {
  const ev = state.evening;
  const step = EV_STEPS[ev.step];
  const text = cleanText(value, 1000);
  const level = eveningSafety(text);
  if (level === "crisis") { state.crisisFrom = "evening"; return go("crisis"); }
  if (level === "professional" && !ev.professional) { ev.professional = true; ev.profShown = false; }
  const key = step === "question" ? "answer" : step === "pause" ? "mood" : step;
  if (!text) { delete ev.answers[key]; } else ev.answers[key] = text;
  if (step === "reflect" || step === "question" || step === "observe" || step === "probe") {
    if (suggestsDecision(text) || text === "Yes — it’s forming" || text === "Still open") ev.decisionForming = true;
  }
  ev.step = Math.min(ev.step + 1, EV_STEPS.length - 1);
  go("evening");
}

function evConfirmLeave() {
  const ev = state.evening;
  if (!ev || ev.savedId) return true;
  const has = Object.keys(ev.answers).length || ev.people.length;
  return !has || confirm("Leave tonight’s reflection? Nothing has been saved, so it will be gone.");
}

function evExplore(depth) {
  const text = evCompositeText(state.evening);
  startFlow(depth);
  if (text) state.session.answers.decision = text; // prefilled; editable on the first question
  render();
}

function saveEveningSettings() { persist(EVENING_KEYS.settings, JSON.stringify(state.eveningSettings)); }

function downloadICS() {
  const ics = buildReminderICS({ time: state.eveningSettings.time, url: eveningLink() });
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "pops-evening-reminder.ics" });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast("Calendar file made on this device — open it to add the nightly reminder");
}

const notifySupported = () => "Notification" in window && "serviceWorker" in navigator;
const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function setupStatus() {
  const s = state.eveningSettings;
  const perm = notifySupported() ? Notification.permission : "unsupported";
  return {
    notify: perm === "unsupported" ? (isInstalled() ? "Unavailable" : "Needs install") : perm === "denied" ? "Blocked" : s.notify && perm === "granted" ? "On" : perm === "default" ? "Needed" : "Off",
    reminder: s.icsAdded ? "On" : "Off",
    morning: state.morningSettings.icsAdded ? "On" : "Off",
    calendar: s.calendar ? "On" : "Off",
    names: s.names === false ? "Off" : "On"
  };
}
function setupHomeCard() {
  const st = setupStatus();
  const on = Object.values(st).filter(v => v === "On").length;
  const n = state.journal.length;
  return `<nav class="home-bar" aria-label="POPS menu">
    <button class="bar-setup" data-eva="setup" aria-label="Set up POPS, ${on} of ${Object.keys(st).length} on">${icon("settings")}<span>Setup</span><small class="bar-badge">${on} of ${Object.keys(st).length} on</small></button>
    <button data-action="journal" aria-label="Open Journal${n ? `, ${n} entries` : ""}">${icon("journal")}<span>Journal</span><small class="bar-badge">${n ? `${n} saved` : "Empty"}</small></button>
    <button data-action="about" aria-label="About POPS">${icon("info")}<span>About</span><small class="bar-badge">How it works</small></button>
  </nav>`;
}
const badge = v => `<span class="status ${v === "On" ? "on" : v === "Needed" ? "need" : ""}">${v}</span>`;
function renderSetup() {
  const s = state.eveningSettings, st = setupStatus();
  const back = state.setupFrom === "evening" && state.evening ? "Back to tonight’s reflection" : "Done";
  app.innerHTML = `<section>${header("Set up POPS", "Everything stays on this device. Turn on only what helps.", { back: "setup-back", right: " " })}
    <div class="card setup-list">
      ${hiddenMantras().length ? `<div class="setup-item"><div><strong>Hidden mantras</strong><p class="field-note">${hiddenMantras().length} hidden with “Not for me”.</p></div><button class="secondary" data-ms="restore">Restore hidden mantras</button></div>` : ""}
      <div class="setup-item"><div><strong>Notifications</strong>${badge(st.notify)}<p class="field-note">${st.notify === "Needs install" ? "On iPhone: Share → Add to Home Screen, then open POPS from the icon." : st.notify === "Blocked" ? "Blocked in your browser settings." : "A local nudge after your reminder time, best effort."}</p></div>
        ${["Needed", "Off", "On"].includes(st.notify) ? `<button class="secondary" data-eva="notify">${st.notify === "On" ? "Turn off" : "Allow"}</button>` : ""}</div>
      <div class="setup-item"><div><strong>Morning reminder</strong>${badge(st.morning)}<p class="field-note">A daily calendar event at ${escapeHTML(formatTime(state.morningSettings.time))} that opens this morning’s line.</p>
        <form id="mo-time-form" class="time-row"><label for="mo-time" class="sr-only">Morning reminder time</label><input id="mo-time" type="time" value="${escapeHTML(state.morningSettings.time)}" required /><button class="plain-link">Set time</button></form></div>
        <button class="secondary" data-mo="ics">${st.morning === "On" ? "Add again" : "Add to calendar"}</button></div>
      <div class="setup-item"><div><strong>Nightly reminder</strong>${badge(st.reminder)}<p class="field-note">A daily calendar event at ${escapeHTML(formatTime(s.time))} that opens tonight’s question.</p>
        <form id="ev-time-form" class="time-row"><label for="ev-time" class="sr-only">Reminder time</label><input id="ev-time" type="time" value="${escapeHTML(s.time)}" required /><button class="plain-link">Set time</button></form></div>
        <button class="secondary" data-eva="ics">${st.reminder === "On" ? "Add again" : "Add to calendar"}</button></div>
      <div class="setup-item"><div><strong>Calendar</strong>${badge(st.calendar)}<p class="field-note">Read today’s events from a calendar file on this device to suggest chips. No account, nothing uploaded or kept.</p></div>
        <button class="secondary" data-eva="calendar">${st.calendar ? "Turn off" : "Connect"}</button></div>
      <div class="setup-item"><div><strong>Remember names</strong>${badge(st.names)}<p class="field-note">Names from saved reflections become quick chips.</p></div>
        <button class="secondary" data-eva="names">${st.names === "On" ? "Turn off" : "Turn on"}</button></div>
    </div>
    <button class="primary" data-eva="setup-back">${back}</button></section>`;
}

async function checkReminder() {
  const s = state.eveningSettings;
  if (!s.notify || !notifySupported() || Notification.permission !== "granted") return;
  const today = dayKey();
  if (s.lastNotified === today || !reminderDue(new Date(), s.time, eveningStats().doneToday)) return;
  s.lastNotified = today; saveEveningSettings();
  const options = { body: questionForDate(new Date()).q, tag: "pops-evening", icon: "icons/pops-192.png", data: { url: "./?open=evening#evening" } };
  try { const reg = await navigator.serviceWorker.ready; await reg.showNotification("POPS · Tonight’s question", options); }
  catch { try { new Notification("POPS · Tonight’s question", options); } catch { /* not available */ } }
}

app.addEventListener("click", async event => {
  const target = event.target.closest("[data-eva], [data-ev-chip], [data-ev-person], [data-action=ev-stop], [data-action=ev-reminders-back], [data-action=setup-back]");
  if (!target || target.disabled) return;
  const ev = state.evening;
  const a = target.dataset.eva || target.dataset.action;
  if (target.dataset.evChip) return evRecord(target.dataset.evChip);
  if (target.dataset.evPerson) {
    const p = target.dataset.evPerson;
    ev.people = ev.people.includes(p) ? ev.people.filter(x => x !== p) : [...ev.people, p];
    return render(false);
  }
  switch (a) {
    case "open": return openEvening();
    case "resume": return go("evening");
    case "back": ev.step = Math.max(0, ev.step - 1); return go("evening");
    case "skip": {
      const step = EV_STEPS[ev.step];
      if (step !== "people") delete ev.answers[step === "question" ? "answer" : step === "pause" ? "mood" : step];
      ev.step = Math.min(ev.step + 1, EV_STEPS.length - 1); return go("evening");
    }
    case "people-done": ev.step += 1; return go("evening");
    case "stop": case "ev-stop": case "done":
      if (!evConfirmLeave()) return;
      state.evening = null; state.calendarChips = []; clearEveningLink(); return go("home");
    case "toggle-decision": ev.decisionForming = !ev.decisionForming; return render(false);
    case "explore-quick": return evExplore("quick");
    case "explore-full": return evExplore("full");
    case "save": {
      if (!state.storageOk) return showToast("This browser is blocking storage, so this can’t be saved.");
      try {
        const entry = createReflectionEntry({ question: ev.question, answers: { ...ev.answers, people: ev.people }, probeQuestion: evProbe(ev).q, decisionForming: ev.decisionForming });
        state.journal.unshift(entry);
        if (persistJournal()) { ev.savedId = entry.id; render(false); showToast("Kept in your Journal on this device"); } else state.journal.shift();
      } catch (error) {
        if (error.message === "crisis") { state.crisisFrom = "evening"; return go("crisis"); }
        showToast(error.message);
      }
      return;
    }
    case "reminders": case "setup": state.setupFrom = state.view === "evening" ? "evening" : "home"; return go("setup");
    case "setup-from-evening": state.setupFrom = "evening"; return go("setup");
    case "setup-back": case "ev-reminders-back": return go(state.setupFrom === "evening" && state.evening ? "evening" : "home");
    case "ics": state.eveningSettings.icsAdded = true; saveEveningSettings(); downloadICS(); return render(false);
    case "calendar": state.eveningSettings.calendar = !state.eveningSettings.calendar; if (!state.eveningSettings.calendar) state.calendarChips = []; saveEveningSettings(); render(false);
      return showToast(state.eveningSettings.calendar ? "Calendar connected — import today’s events from the evening step" : "Calendar off");
    case "names": state.eveningSettings.names = state.eveningSettings.names === false; saveEveningSettings(); return render(false);
    case "notify": {
      const s = state.eveningSettings;
      if (s.notify && Notification.permission === "granted") { s.notify = false; saveEveningSettings(); return render(false); }
      if (!notifySupported()) return;
      const result = await Notification.requestPermission();
      s.notify = result === "granted"; saveEveningSettings(); render(false);
      showToast(s.notify ? "Notifications on — shown locally, best effort" : "Notifications weren’t allowed");
      return checkReminder();
    }
  }
});

app.addEventListener("click", event => {
  const fs = event.target.closest("[data-fs]");
  if (fs) { state.focusSheet = fs.dataset.fs === "open"; state.mantraSheet = null; return render(false); }
  const ms = event.target.closest("[data-ms], [data-ms-chip]");
  if (ms) {
    const s = state.mantraSheet || (state.mantraSheet = { commenting: false, chip: "", draft: "" });
    const input = document.querySelector("#ms-input"); if (input) s.draft = input.value;
    if (ms.dataset.msChip) { s.chip = s.chip === ms.dataset.msChip ? "" : ms.dataset.msChip; return render(false); }
    switch (ms.dataset.ms) {
      case "log": return saveMantra("");
      case "comment": s.commenting = !s.commenting; render(false); return document.querySelector("#ms-input")?.focus();
      case "new": state.mantraOffset = (state.mantraOffset || 0) + 1; s.commenting = false; s.chip = ""; s.draft = ""; return render(false);
      case "hide": { const h = hiddenMantras(); h.push(mantra()); persist(MANTRA_HIDDEN_KEY, JSON.stringify(h)); state.mantraSheet = null; render(false); return showToast("Hidden on this device · restore it in Setup"); }
      case "close": state.mantraSheet = null; return render(false);
      case "restore": state.mantraSheet = null; localStorage.removeItem(MANTRA_HIDDEN_KEY); render(false); return showToast("Hidden mantras restored");
    }
    return;
  }
  const t = event.target.closest("[data-mo], [data-mo-chip], [data-mo-mood]");
  if (!t) return;
  if (t.dataset.moMood) { const m = state.morning || (state.morning = { pick: "", mood: "" }); m.mood = m.mood === t.dataset.moMood ? "" : t.dataset.moMood; return render(false); }
  if (t.dataset.moChip) { const m = state.morning || (state.morning = { pick: "" }); m.pick = m.pick === t.dataset.moChip ? "" : t.dataset.moChip; return render(false); }
  switch (t.dataset.mo) {
    case "open": return openMorning();
    case "open-keep": return go("morning");
    case "sheet": state.mantraSheet = state.mantraSheet ? null : { commenting: false, chip: "", draft: "" }; return render(false);
    case "later": state.morning = null; clearMorningLink(); return go("home");
    case "ics": state.morningSettings.icsAdded = true; saveMorningSettings(); downloadMorningICS(); return render(false);
  }
});

app.addEventListener("submit", event => {
  const id = event.target.id;
  if (id === "ms-form") { event.preventDefault(); const s = state.mantraSheet || {}; const typed = document.querySelector("#ms-input").value.trim(); return saveMantra([s.chip, typed].filter(Boolean).join(" — ")); }
  if (id === "mo-form") { event.preventDefault(); return saveMorning(document.querySelector("#mo-input").value.trim()); }
  if (id === "mo-time-form") {
    event.preventDefault();
    const value = document.querySelector("#mo-time").value;
    if (!/^\d{2}:\d{2}$/.test(value)) return showToast("Pick a time first.");
    state.morningSettings.time = value; saveMorningSettings(); render(false);
    return showToast(`Morning reminder set to ${formatTime(value)} — re-add it to your calendar to update`);
  }
  if (id === "ev-form") { event.preventDefault(); return evRecord(document.querySelector("#ev-input").value); }
  if (id === "ev-person-form") {
    event.preventDefault();
    const value = cleanText(document.querySelector("#ev-person").value, 80);
    if (!value) return;
    if (eveningSafety(value) === "crisis") { state.crisisFrom = "evening"; return go("crisis"); }
    if (!state.evening.people.includes(value)) state.evening.people.push(value);
    render(false); document.querySelector("#ev-person")?.focus(); return;
  }
  if (id === "ev-time-form") {
    event.preventDefault();
    const value = document.querySelector("#ev-time").value;
    if (!/^\d{2}:\d{2}$/.test(value)) return showToast("Pick a time first.");
    state.eveningSettings.time = value; state.eveningSettings.lastNotified = null; saveEveningSettings(); render(false);
    showToast(`Reminder time set to ${formatTime(value)} — saved on this device`);
  }
});

app.addEventListener("change", event => {
  if (event.target.id !== "ev-ics") return;
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const titles = parseICSEvents(String(reader.result), dayKey());
    state.calendarChips = [...new Set([...state.calendarChips, ...titles])].slice(0, 20);
    render(false);
    showToast(titles.length ? `${titles.length} event${titles.length === 1 ? "" : "s"} from today — tap any that fit` : "No events for today in that file");
  };
  reader.readAsText(file);
});

// --------------------------------------------------------------------------- Start
routeFromURL(false);
window.addEventListener("hashchange", () => routeFromURL(true));
checkReminder();
document.addEventListener("visibilitychange", () => { if (!document.hidden) { checkReminder(); if (state.view === "home") render(false); } });
setInterval(checkReminder, 60000);
// exposed for tests only — no data, just the beat ids
window.__POPS__ = { version: APP_VERSION, beats: BEATS.map(b => b.id) };
