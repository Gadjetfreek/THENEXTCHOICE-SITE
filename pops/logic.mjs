// POPS beta v0.1 — pure, offline decision-companion logic.
// No network, no AI model, no hidden answer. Everything here is deterministic
// so it can be unit-tested and reasoned about.

export const APP_VERSION = "0.3.0-beta";

export const STORAGE_KEYS = Object.freeze({
  journal: "pops.journal.v1", // same key as PR #17 so earlier notes survive the upgrade
  current: "pops.current.v1",
  nudges: "pops.nudges.v1"
});

export const POPS_STAGES = Object.freeze(["Pause", "Observe", "Probe", "Select"]);

export const VALUE_LENS = Object.freeze([
  { key: "values", label: "Values", definition: "What is this option meant to make possible, protect, or honor?" },
  { key: "alternatives", label: "Alternatives", definition: "What else could you do — another path, different terms, waiting, or no action?" },
  { key: "learning", label: "Learning", definition: "What did this encounter teach that the earlier version of you did not know?" },
  { key: "uncertainty", label: "Uncertainty", definition: "What do we not know, can we learn it, and what if it resolves badly?" },
  { key: "evidence", label: "Evidence", definition: "What supports this claim, what challenges it, and how much weight should it carry?" }
]);

// POPS always offers these, so it can never quietly narrow the choice to "act".
export const WAIT_OPTION = "Wait and revisit later";
export const NO_ACTION_OPTION = "Take no action for now";
export const NOT_READY_OPTION = "I’m not ready to choose yet";
export const ALWAYS_AVAILABLE = Object.freeze([WAIT_OPTION, NO_ACTION_OPTION]);

export const MAX_ALTERNATIVES = 4;

/**
 * One question at a time. Each beat may offer quick choices, but every beat
 * also accepts the person's own words ("I'd rather…") and can be skipped.
 */
export const BEATS = Object.freeze([
  { id: "decision", stage: "Pause", field: "decision", kind: "text", quick: true,
    prompt: "What choice is asking for your attention?",
    help: "A sentence is plenty. You can stay vague.",
    placeholder: "e.g. Whether to accept the new role",
    choices: ["I’d rather not name it yet"] },
  { id: "room", stage: "Pause", field: "room", kind: "choice",
    prompt: "Before anything else — what would help make a little room?",
    choices: ["One slow breath", "Name what feels urgent", "Notice how my body feels"] },
  { id: "deadline", stage: "Pause", field: "deadline", kind: "choice",
    prompt: "How much time do you really have before this has to be decided?",
    choices: ["Minutes", "Today", "This week", "No real deadline", "I’m not sure"] },
  { id: "facts", stage: "Observe", field: "facts", kind: "text", quick: true,
    prompt: "What do you know directly — what you saw, heard, or can check?",
    help: "Facts first. Interpretations can wait.",
    choices: ["Not much yet"] },
  { id: "affected", stage: "Observe", field: "affected", kind: "choice",
    prompt: "Who else lives with the result of this choice?",
    choices: ["Just me", "My partner or family", "People at work", "Someone who isn’t here to speak"] },
  { id: "values", stage: "Probe", lens: "Values", field: "values", kind: "text", quick: true,
    prompt: "What do you want this choice to protect, make possible, or honor?",
    choices: ["My health", "A relationship", "My integrity", "Security"] },
  { id: "alternatives", stage: "Probe", lens: "Alternatives", field: "alternatives", kind: "options", quick: true,
    prompt: "What paths are actually open to you?",
    help: "Add up to four in your own words. POPS always keeps waiting and no action on the list too." },
  { id: "learning", stage: "Probe", lens: "Learning", field: "learning", kind: "text",
    prompt: "What has a past choice like this taught you?",
    choices: ["Nothing comes to mind", "I’ve never faced this before"] },
  { id: "uncertainty", stage: "Probe", lens: "Uncertainty", field: "uncertainty", kind: "text",
    prompt: "What don’t you know yet — and what happens if it goes badly?",
    choices: ["Something I could find out first", "Something no one can know yet"] },
  { id: "evidence", stage: "Probe", lens: "Evidence", field: "evidence", kind: "text",
    prompt: "What supports the path you’re leaning toward — and what pushes against it?",
    choices: ["I’m not leaning yet"] },
  { id: "missing", stage: "Probe", field: "missing", kind: "text",
    prompt: "What might you be missing — including someone else’s experience of this?",
    choices: ["I should ask someone", "I’m honestly not sure"] },
  { id: "selection", stage: "Select", field: "selection", kind: "select", quick: true,
    prompt: "Which path can you stand behind right now?",
    help: "POPS won’t pick for you. Waiting, no action, and not choosing yet are real options." },
  { id: "nextStep", stage: "Select", field: "nextStep", kind: "text", quick: true,
    prompt: "What’s the smallest next step you’re ready to own?",
    choices: ["Talk to someone first", "Find out one more fact", "Sleep on it"] },
  { id: "revisit", stage: "Select", field: "revisit", kind: "text",
    prompt: "What would make you reconsider?",
    choices: ["If something new comes up", "I’ll check back in a week"] }
]);

export const DEPTHS = Object.freeze({
  quick: { label: "Quick", description: "6 questions · about 3 minutes" },
  full: { label: "Full", description: "14 questions · about 10 minutes" }
});

export function beatsFor(depth = "full") {
  return depth === "quick" ? BEATS.filter(beat => beat.quick) : [...BEATS];
}

export function cleanText(value, maximum = 2000) {
  return String(value ?? "").trim().slice(0, maximum);
}

// ---------------------------------------------------------------------------
// Safety (adapted from the recovered safety.ts). Evaluated BEFORE anything is
// kept in the session, so crisis text is never stored.
// ---------------------------------------------------------------------------
const CRISIS_PATTERNS = [
  /\b(kill(ing)? myself|suicid(e|al)|end (my|it all|my own) life|want to die|wanna die|better off dead|hurt(ing)? myself|self[- ]?harm|cut(ting)? myself|overdose)\b/i,
  /\b(going to|gonna|plan(ning)? to|want to) (kill|hurt|attack|shoot|stab)\b/i,
  /\b(being (beaten|abused|threatened|hurt)|in (immediate )?danger|not safe at home)\b/i
];

const PROFESSIONAL_PATTERNS = [
  /\b(depressed|depression|anxiety|panic attacks?|mental health|therapist|counsel+or|psychiatrist)\b/i,
  /\b(legal advice|lawsuit|custody|attorney|lawyer|court date)\b/i,
  /\b(diagnos(is|ed)|prescription|medication|doctor said|surgery)\b/i,
  /\b(financial advis[oe]r|bankruptcy|investment advice|foreclosure)\b/i
];

export function assessSafety(text) {
  const value = String(text ?? "");
  if (CRISIS_PATTERNS.some(pattern => pattern.test(value))) return { level: "crisis" };
  if (PROFESSIONAL_PATTERNS.some(pattern => pattern.test(value))) return { level: "professional" };
  return { level: "none" };
}

export const CRISIS_MESSAGE = Object.freeze({
  title: "Let’s pause the reflection.",
  body: "What you wrote may mean you need a person right now. POPS is not a crisis service and can’t help in an emergency — and it has not contacted anyone. You don’t have to go through this alone.",
  notStored: "What you just typed was not saved anywhere."
});

export const PROFESSIONAL_NOTE = "This may deserve qualified support too. POPS is not medical, legal, financial, or mental-health advice — it can only help you think.";

// ---------------------------------------------------------------------------
// Session (memory only — never written to storage until the person taps Save)
// ---------------------------------------------------------------------------
export function createSession(depth = "full", now = new Date(), id = crypto.randomUUID()) {
  return { id, depth: depth === "quick" ? "quick" : "full", startedAt: now.toISOString(), index: 0, answers: {}, skipped: [], professionalNoted: false };
}

/** Record an answer for the beat at session.index. Returns { session, safety }. Does not mutate. */
export function answerBeat(session, value, { returnTo } = {}) {
  const beats = beatsFor(session.depth);
  const beat = beats[session.index];
  if (!beat) throw new Error("This reflection is already complete.");
  const texts = Array.isArray(value) ? value.map(item => cleanText(item, 160)).filter(Boolean) : [cleanText(value, 1000)];
  for (const text of texts) {
    const safety = assessSafety(text);
    if (safety.level === "crisis") return { session, safety }; // nothing recorded
  }
  if (beat.kind !== "options" && !texts[0]) throw new Error("Add a few words, choose an option, or skip.");
  const stored = beat.kind === "options" ? dedupe(texts).slice(0, MAX_ALTERNATIVES) : texts[0];
  const professional = texts.some(text => assessSafety(text).level === "professional");
  const next = {
    ...session,
    answers: { ...session.answers, [beat.field]: stored },
    skipped: session.skipped.filter(field => field !== beat.field),
    index: returnTo === "card" ? beats.length : session.index + 1,
    professionalNoted: session.professionalNoted || professional
  };
  return { session: next, safety: { level: professional ? "professional" : "none" } };
}

export function skipBeat(session, { returnTo } = {}) {
  const beats = beatsFor(session.depth);
  const beat = beats[session.index];
  if (!beat) return session;
  const answers = { ...session.answers };
  delete answers[beat.field];
  return { ...session, answers, skipped: dedupe([...session.skipped, beat.field]), index: returnTo === "card" ? beats.length : session.index + 1 };
}

export function goBack(session) {
  return { ...session, index: Math.max(0, session.index - 1) };
}

export function jumpTo(session, field) {
  const index = beatsFor(session.depth).findIndex(beat => beat.field === field);
  return index < 0 ? session : { ...session, index };
}

export function isComplete(session) {
  return session.index >= beatsFor(session.depth).length;
}

/** Options offered at Select: the person's own paths, then the always-available ones. */
export function selectOptions(answers) {
  const own = Array.isArray(answers.alternatives) ? answers.alternatives : [];
  return dedupe([...own, ...ALWAYS_AVAILABLE, NOT_READY_OPTION]);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Decision card — the only thing Journal keeps from a reflection (no transcript)
// ---------------------------------------------------------------------------
export function buildCard(session, now = new Date()) {
  const a = session.answers;
  const alternatives = dedupe([...(Array.isArray(a.alternatives) ? a.alternatives : []), ...ALWAYS_AVAILABLE]);
  const selection = a.selection || "";
  return {
    decision: a.decision || "",
    room: a.room || "",
    deadline: a.deadline || "",
    facts: a.facts || "",
    affected: a.affected || "",
    values: a.values || "",
    alternatives,
    learning: a.learning || "",
    uncertainty: a.uncertainty || "",
    evidence: a.evidence || "",
    missing: a.missing || "",
    selection,
    nextStep: a.nextStep || "",
    revisit: a.revisit || "",
    skipped: [...session.skipped],
    depth: session.depth,
    handback: handbackLine(selection),
    completedAt: now.toISOString()
  };
}

export function handbackLine(selection) {
  if (!selection) return "You haven’t named a path, and that’s allowed. The choice stays yours.";
  if (selection === NOT_READY_OPTION) return "Not choosing yet is a real choice. You can come back to this whenever you want.";
  if (selection === WAIT_OPTION || selection === NO_ACTION_OPTION) return "Waiting is a real option. POPS didn’t choose this — you did.";
  return "POPS didn’t choose this — you did. It’s yours to keep, change, or drop.";
}

export const CARD_FIELDS = Object.freeze([
  ["decision", "The choice"], ["deadline", "Time available"], ["facts", "What you know"], ["affected", "Who’s affected"],
  ["values", "Values"], ["alternatives", "Alternatives"], ["learning", "Learning"], ["uncertainty", "Uncertainty"],
  ["evidence", "Evidence"], ["missing", "Might be missing"], ["selection", "Your choice"], ["nextStep", "Next step"], ["revisit", "Reconsider if"]
]);

export function cardToText(card) {
  return CARD_FIELDS
    .map(([key, label]) => {
      const value = Array.isArray(card[key]) ? card[key].join("; ") : card[key];
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean)
    .concat(card.handback)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Journal — explicit save only
// ---------------------------------------------------------------------------
export function createJournalEntry(text, now = new Date(), id = crypto.randomUUID()) {
  const originalText = cleanText(text);
  if (!originalText) throw new Error("Journal text is required.");
  return { id, kind: "note", originalText, createdAt: now.toISOString(), source: "Typed by you on this device" };
}

export function createDecisionEntry(card, now = new Date(), id = crypto.randomUUID()) {
  if (!card || typeof card !== "object") throw new Error("A decision card is required.");
  return {
    id,
    kind: "decision",
    version: 1,
    createdAt: now.toISOString(),
    source: "Saved by you from a POPS reflection on this device",
    title: cleanText(card.decision, 120) || "Unnamed choice",
    card,
    originalText: cardToText(card)
  };
}

/** Accepts PR #17 entries (no kind) and current entries; drops anything malformed or carrying a transcript. */
export function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.createdAt) return null;
  const { messages: _messages, transcript: _transcript, ...rest } = entry;
  if (rest.kind === "decision" && rest.card) return rest;
  if (rest.kind === "morning" && typeof rest.intention === "string" && typeof rest.originalText === "string") return rest;
  if (rest.kind === "reflection" && rest.answers && typeof rest.originalText === "string") return rest;
  if (typeof rest.originalText !== "string" || !rest.originalText) return null;
  return { ...rest, kind: "note" };
}

export function parseStoredArray(raw) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function parseJournal(raw) {
  return parseStoredArray(raw).map(normalizeEntry).filter(Boolean);
}

export function exportJournal(entries, now = new Date()) {
  return JSON.stringify({ app: "POPS", version: APP_VERSION, exportedAt: now.toISOString(), entries }, null, 2);
}

export function nudgeSummary(preference) {
  if (!preference || preference.mode === "no") return "Nudges off";
  if (preference.mode === "yes") return `Simulated check-in: ${preference.minutes || 10} min before`;
  return `Simulated check-in: ${cleanText(preference.custom, 60) || "custom timing"}`;
}
