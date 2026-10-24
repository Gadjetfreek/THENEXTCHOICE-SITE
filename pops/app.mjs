import {
  APP_VERSION, BEATS, CARD_FIELDS, CRISIS_MESSAGE, DEPTHS, MAX_ALTERNATIVES, POPS_STAGES, PROFESSIONAL_NOTE,
  STORAGE_KEYS, VALUE_LENS, answerBeat, assessSafety, beatsFor, buildCard, cleanText, createDecisionEntry, createJournalEntry,
  createSession, exportJournal, goBack, isComplete, jumpTo, nudgeSummary, parseJournal, selectOptions, skipBeat
} from "./logic.mjs";

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
  storageOk: storageAvailable()
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
  plus: '<path d="M12 5v14M5 12h14"/>'
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
    <div class="brand-row"><div><p class="eyebrow">Pause · Observe · Probe · Select</p><h1>POPS</h1></div>
      <div class="brand-actions">
        <button class="journal-shortcut" data-action="about" aria-label="About POPS">${icon("info")}<span>About</span></button>
        <button class="journal-shortcut" data-action="journal" aria-label="Open Journal">${icon("journal")}<span>Journal${state.journal.length ? ` · ${state.journal.length}` : ""}</span></button>
      </div>
    </div>
    <button class="current-card" data-action="current">
      <span>${icon("current")}<small>Current</small></span>
      <strong>${escapeHTML(state.current)}</strong>
    </button>
    <div class="action-grid" aria-label="POPS sections">
      ${tile("attend", "Attend", true)}${tile("relate", "Relate", true)}
      ${tile("pause", "Pause", false, state.session && !isComplete(state.session) ? "Resume reflection" : "Bring a real choice")}${tile("reflect", "Reflect", true)}
    </div>
    <span id="later-note" class="sr-only">Coming later</span>
    <button class="next-card" data-action="next">
      <span>${icon("next")}<span><small>Next</small><strong>Likely interruption or obligation</strong></span></span>
      <em>${escapeHTML(nudgeSummary(state.nudges))}</em>
    </button>
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
      <p class="field-note">988 serves the US. Outside the US, call your local emergency number. ${state.crisisFrom === "input" ? escapeHTML(CRISIS_MESSAGE.notStored) : ""}</p>
      <div class="crisis-resume">
        ${state.session && !isComplete(state.session) && state.crisisFrom === "input" ? '<button data-action="crisis-resume">I’m safe right now — continue the reflection</button>' : ""}
        ${state.crisisFrom === "direct" && state.session ? '<button data-action="crisis-resume">I’m okay — go back</button>' : ""}
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
      <div class="entry-meta"><span class="kind ${e.kind}">${e.kind === "decision" ? "Decision card" : "Note"}</span><time>${formatDate(e.createdAt)}</time></div>
      ${e.kind === "decision" ? `<h3>${escapeHTML(e.title)}</h3><p>${e.card.selection ? `<strong>Your choice:</strong> ${escapeHTML(e.card.selection)}` : "No path named"}</p>` : `<p>${escapeHTML(e.originalText)}</p>`}
      <div><button data-open="${e.id}">${e.kind === "decision" ? "Open card" : "View source"}</button><button class="danger" data-delete="${e.id}">${icon("trash")} Delete</button></div>
    </article>`).join("")}</div>
    <div class="journal-footer"><button data-action="export">Download a copy (JSON)</button><button class="danger-text" data-action="delete-all">Delete everything</button></div>`;
}

function entryPanel(entry) {
  return `<div class="modal-backdrop" data-action="close-entry"><article class="source-panel" role="dialog" aria-modal="true" aria-labelledby="entry-title" data-panel>
    <p class="eyebrow">${entry.kind === "decision" ? "Saved decision card" : "Narrative → source"}</p>
    <h2 id="entry-title">${escapeHTML(entry.kind === "decision" ? entry.title : "Original entry")}</h2>
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

const VIEWS = { settings: renderSettings, home: renderHome, about: renderAbout, current: renderCurrent, start: renderStart, flow: renderFlow, crisis: renderCrisis, journal: renderJournal, next: renderNext };
function render(focus = true) {
  (VIEWS[state.view] || renderHome)();
  if (focus) {
    window.scrollTo({ top: 0 });
    const target = app.querySelector(".question, h1");
    if (target) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
  }
}

// --------------------------------------------------------------------------- Actions
function go(view) { state.view = view; state.customAnswer = false; render(); }

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
    case "crisis-end": state.session = null; state.returnTo = null; return go("home");
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
render(false);
// exposed for tests only — no data, just the beat ids
window.__POPS__ = { version: APP_VERSION, beats: BEATS.map(b => b.id) };
