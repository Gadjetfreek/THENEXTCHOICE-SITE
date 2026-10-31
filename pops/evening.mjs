// POPS evening reflection — the nightly "POPR moment": Pause, Observe, Probe, Reflect.
// Pure, deterministic, offline logic (unit-tested). No network, no AI, no calendar API.
// A live calendar connector (Google/Outlook OAuth) is a possible LATER option; this beta
// only reads an .ics file the person chooses, entirely on this device.
import { assessSafety, cleanText } from "./logic.mjs";

export const EVENING_KEYS = Object.freeze({ settings: "pops.evening.v1" });
export const POPR_STAGES = Object.freeze(["Pause", "Observe", "Probe", "Reflect"]);
export const DEFAULT_REMINDER = "21:00";

// Each question has 3–4 quick-tap answers; "Write your own" is always offered too.
export const QUESTIONS = Object.freeze([
  { q: "What moment from today would you want to remember a year from now?", chips: ["A conversation", "Something small and quiet", "Something I got done", "Nothing stands out yet"] },
  { q: "Where did you feel most like yourself today?", chips: ["At work", "With family", "Alone for a minute", "I’m not sure I did"] },
  { q: "What took more energy today than you expected?", chips: ["A person", "A task", "Waiting on something", "My own thoughts"] },
  { q: "Who made today a little easier — and do they know it?", chips: ["Someone at home", "A coworker", "A stranger", "No one comes to mind"] },
  { q: "What did you say yes to today that you might have said no to?", chips: ["A favor", "More work", "Something fun", "Nothing like that"] },
  { q: "What’s one thing you noticed today that you usually walk past?", chips: ["Something outside", "How someone looked", "How I felt", "Didn’t notice much"] },
  { q: "If today had a title, what would it be?", chips: ["Steady", "Too much", "Quietly good", "Unfinished"] },
  { q: "What are you still carrying from today that isn’t yours to carry?", chips: ["Someone’s mood", "A worry", "An old story", "Nothing tonight"] },
  { q: "When did you pause today — even briefly — before reacting?", chips: ["In a conversation", "Before a reply", "I didn’t, really", "Right now"] },
  { q: "What did today teach you about what you need?", chips: ["Rest", "People", "Space", "Structure"] },
  { q: "Which conversation from today is still echoing?", chips: ["A good one", "A hard one", "One I avoided", "None"] },
  { q: "What did you do today that the younger you would be glad about?", chips: ["Kept a promise", "Showed up", "Let something go", "Not sure"] },
  { q: "Where did your attention go today when you didn’t choose it?", chips: ["My phone", "Worry", "Other people’s needs", "Work"] },
  { q: "What’s one thing you’re grateful for that cost nothing?", chips: ["A laugh", "Weather", "A kind word", "Quiet"] },
  { q: "What did you avoid today, and what was underneath it?", chips: ["A hard talk", "A task", "A feeling", "Nothing I noticed"] },
  { q: "Who did you think about today but didn’t reach out to?", chips: ["Family", "An old friend", "Someone I miss", "No one"] },
  { q: "What went better than you feared?", chips: ["A meeting", "A conversation", "A task", "Nothing yet"] },
  { q: "What would you do differently if you could replay one hour of today?", chips: ["Slow down", "Speak up", "Listen more", "Nothing — it was fine"] },
  { q: "Where did you see someone else’s effort today?", chips: ["At home", "At work", "Out in the world", "I missed it"] },
  { q: "What small choice today turned out to matter?", chips: ["How I started the day", "Something I said", "Something I skipped", "Too soon to tell"] },
  { q: "What did your body try to tell you today?", chips: ["I’m tired", "I’m tense", "I feel good", "I didn’t listen"] },
  { q: "What are you proud of today that no one saw?", chips: ["Patience", "Effort", "Honesty", "Restraint"] },
  { q: "What question did today leave you with?", chips: ["About work", "About someone", "About myself", "None yet"] },
  { q: "When did you feel rushed today, and who set the pace?", chips: ["I did", "Work did", "Someone else did", "I didn’t feel rushed"] },
  { q: "What would you like to tell someone about today?", chips: ["Something funny", "Something hard", "Something good", "Nothing yet"] },
  { q: "What did you learn about someone close to you today?", chips: ["Something new", "Something I’d forgotten", "Something hard", "Nothing new"] },
  { q: "Where did you choose well today, even in a small way?", chips: ["What I ate", "What I said", "When I stopped", "Can’t think of one"] },
  { q: "What part of today would you rather not repeat?", chips: ["A moment of temper", "Wasted time", "A worry spiral", "None of it"] },
  { q: "What gave you a little hope today?", chips: ["A person", "News", "Progress", "Nothing, honestly"] },
  { q: "What are you looking forward to — even a little — tomorrow?", chips: ["Seeing someone", "Finishing something", "Rest", "Not sure yet"] },
  { q: "If a good friend lived your day, what would you say to them tonight?", chips: ["You did enough", "Be gentle", "That was a lot", "Well done"] },
  { q: "What deserves a second look before you let today go?", chips: ["Something I said", "A decision", "A feeling", "Nothing — I’m ready"] }
]);

const STEP = 13; // coprime with 32 → a full cycle: no question repeats within 32 days

/** Local calendar day as YYYY-MM-DD (the person's own time zone). */
export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayNumber(date) {
  const d = new Date(date);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export function questionIndexForDate(date = new Date(), size = QUESTIONS.length) {
  return (((dayNumber(date) * STEP) % size) + size) % size;
}

export function questionForDate(date = new Date()) {
  return QUESTIONS[questionIndexForDate(date)];
}

export const MOOD_CHIPS = Object.freeze(["Calm", "Tired", "Wired", "Heavy", "Grateful", "Scattered"]);
export const OBSERVE_CHIPS = Object.freeze(["Mostly routine", "Something surprised me", "A hard moment", "A good moment"]);
export const REFLECT_CHIPS = Object.freeze(["Go a little slower", "Check in with someone", "Let something go", "Nothing in particular"]);

/** One deeper follow-up that adapts to what came before. Never a judgment. */
export function probeFor(answers = {}) {
  const all = [answers.answer, answers.observe, answers.mood].filter(Boolean).join(" ").toLowerCase();
  if (/\b(heavy|tired|drained|too much|hard|tense|worry|stress|rushed)\b/.test(all))
    return { q: "What took the most out of you — and what, if anything, gave a little back?", chips: ["A person", "A task", "Rest helped", "Nothing gave back yet"] };
  if (/\b(decid|decision|choice|torn|should i|whether)\b/.test(all))
    return { q: "Is there a choice underneath today? What part of it is still open?", chips: ["Yes — it’s forming", "It’s someone else’s choice", "Not really"] };
  if ((answers.people || []).length || /\b(conversation|someone|friend|family|coworker|person|people|talk)\b/.test(all))
    return { q: "What did that interaction ask of you — and what did you give?", chips: ["Patience", "Honesty", "My time", "More than I had"] };
  if (/\b(good|grateful|proud|calm|hope|laugh|well done)\b/.test(all))
    return { q: "What made that possible — and could you make room for it again?", chips: ["Slowing down", "Being with people", "Luck", "I’m not sure"] };
  return { q: "What’s one thing about today you’d understand better with another minute of attention?", chips: ["Why I reacted", "What someone meant", "What I want", "Nothing — I’m settled"] };
}

const DECISION_HINT = /\b(decide|deciding|decision|should i|whether to|torn between|can'?t choose|weighing|choice to make)\b/i;
export function suggestsDecision(text) { return DECISION_HINT.test(String(text ?? "")); }

/** Any crisis language in any field stops the evening walk (nothing is recorded). */
export function eveningSafety(values) {
  const texts = (Array.isArray(values) ? values : [values]).flat().map(v => String(v ?? ""));
  if (texts.some(t => assessSafety(t).level === "crisis")) return "crisis";
  if (texts.some(t => assessSafety(t).level === "professional")) return "professional";
  return "none";
}

export const REFLECTION_LABELS = Object.freeze([
  ["answer", "Tonight’s answer"], ["mood", "Arriving as"], ["observe", "What happened"], ["people", "People & plans"],
  ["probe", "Going deeper"], ["reflect", "Carrying into tomorrow"]
]);

export function reflectionToText(entry) {
  const lines = [`Tonight’s question: ${entry.question}`];
  for (const [key, label] of REFLECTION_LABELS) {
    const v = key === "probe" ? entry.answers.probe && `${entry.probeQuestion} — ${entry.answers.probe}` : entry.answers[key];
    const value = Array.isArray(v) ? v.join(", ") : v;
    if (value) lines.push(`${label}: ${value}`);
  }
  if (entry.decisionForming) lines.push("A decision is forming.");
  return lines.join("\n");
}

/** Build the dated Journal entry. Only called on an explicit Save. */
export function createReflectionEntry({ question, answers = {}, probeQuestion = "", decisionForming = false }, now = new Date(), id = crypto.randomUUID()) {
  const clean = {};
  for (const [key] of REFLECTION_LABELS) {
    const v = answers[key];
    if (Array.isArray(v)) { const list = [...new Set(v.map(x => cleanText(x, 80)).filter(Boolean))].slice(0, 20); if (list.length) clean[key] = list; }
    else if (cleanText(v, 1000)) clean[key] = cleanText(v, 1000);
  }
  if (!Object.keys(clean).length) throw new Error("Answer at least one step, or choose Done without saving.");
  if (eveningSafety(Object.values(clean)) === "crisis") throw new Error("crisis");
  const entry = {
    id, kind: "reflection", version: 1, createdAt: now.toISOString(), day: dayKey(now),
    source: "Saved by you from an evening reflection on this device",
    question: cleanText(question, 300), probeQuestion: cleanText(probeQuestion, 300), answers: clean, decisionForming: !!decisionForming
  };
  return { ...entry, originalText: reflectionToText(entry) };
}

/** Gentle count — total reflections and how many of the last 7 days had one. No streak-breaking guilt. */
export function reflectionStats(journal, now = new Date()) {
  const days = new Set(journal.filter(e => e.kind === "reflection").map(e => e.day || dayKey(e.createdAt)));
  let lastWeek = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(d.getDate() - i); if (days.has(dayKey(d))) lastWeek++; }
  return { total: journal.filter(e => e.kind === "reflection").length, days: days.size, lastWeek, doneToday: days.has(dayKey(now)) };
}

export function statsLine(stats) {
  if (!stats.total) return "Your first evening reflection is waiting whenever you are.";
  const base = `${stats.total} reflection${stats.total === 1 ? "" : "s"} kept`;
  return stats.lastWeek ? `${base} · ${stats.lastWeek} of the last 7 evenings` : `${base} · welcome back`;
}

/** Names/plans remembered locally from past saved reflections, most frequent first. */
export function knownPeople(journal, limit = 12) {
  const counts = new Map();
  for (const e of journal) if (e.kind === "reflection") for (const p of e.answers?.people || []) counts.set(p, (counts.get(p) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([p]) => p);
}

export function parseTime(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return { h: +m[1], m: +m[2] };
}

export function formatTime(value) {
  const t = parseTime(value) || parseTime(DEFAULT_REMINDER);
  const h = t.h % 12 || 12;
  return `${h}:${String(t.m).padStart(2, "0")} ${t.h < 12 ? "AM" : "PM"}`;
}

/** True when it's at/after the reminder time today and tonight's reflection isn't saved yet. */
export function reminderDue(now, time, doneToday) {
  const t = parseTime(time) || parseTime(DEFAULT_REMINDER);
  return !doneToday && now.getHours() * 60 + now.getMinutes() >= t.h * 60 + t.m;
}

// --------------------------------------------------------------------------- .ics (RFC 5545)
function icsEscape(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function fold(line) {
  const out = []; let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest); return out.join("\r\n");
}
const stampUTC = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A daily recurring calendar event (floating local time) with an alarm that links to the deep link. */
export function buildReminderICS({ time = DEFAULT_REMINDER, url, now = new Date(), uid = "pops-evening-reflection@pops" } = {}) {
  const t = parseTime(time) || parseTime(DEFAULT_REMINDER);
  const start = `${dayKey(now).replace(/-/g, "")}T${String(t.h).padStart(2, "0")}${String(t.m).padStart(2, "0")}00`;
  const desc = `Tonight’s question is waiting. Open POPS: ${url}`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//POPS//Evening reflection//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stampUTC(now)}`, `DTSTART:${start}`, "DURATION:PT5M", "RRULE:FREQ=DAILY",
    `SUMMARY:${icsEscape("POPS · Evening reflection")}`, `DESCRIPTION:${icsEscape(desc)}`, `URL:${url}`, "TRANSP:TRANSPARENT",
    "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT0M", `DESCRIPTION:${icsEscape(desc)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].map(fold).join("\r\n") + "\r\n";
}

function icsUnescape(s) { return s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1"); }

/** Read event titles from an .ics file the person picked. If `day` is given, keep only events on that local day. */
export function parseICSEvents(text, day) {
  const lines = String(text || "").replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events = []; let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") { if (cur?.summary) events.push(cur); cur = null; }
    else if (cur) {
      const i = line.indexOf(":"); if (i < 0) continue;
      const name = line.slice(0, i).split(";")[0].toUpperCase(); const value = line.slice(i + 1);
      if (name === "SUMMARY") cur.summary = cleanText(icsUnescape(value), 80);
      if (name === "DTSTART") cur.start = value;
    }
  }
  const onDay = e => {
    if (!day || !e.start) return !day;
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(e.start); if (!m) return false;
    if (m[7]) return dayKey(new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]))) === day;
    return `${m[1]}-${m[2]}-${m[3]}` === day;
  };
  return [...new Set(events.filter(onDay).map(e => e.summary))];
}
