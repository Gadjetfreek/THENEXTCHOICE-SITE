// Morning inspiration: one line per day about deciding well (POPS + VALUE lens), plus an optional intention.
// Deterministic by date, so there's no server and no network. Lines are original to POPS.
// Nothing is stored unless the person taps Save.
import { cleanText } from "./logic.mjs";
import { dayKey, eveningSafety } from "./evening.mjs";

export const MORNING_KEYS = Object.freeze({ settings: "pops.morning.v1" });
export const DEFAULT_MORNING_REMINDER = "07:00";
const STEP = 17; // coprime with the bank size, so no line repeats within LINES.length days

export const LINES = Object.freeze([
  "Before you react today, give yourself one breath. The choice will still be there, and so will you.",
  "Name what matters before you weigh the options. It makes the weighing honest.",
  "Waiting is a choice too. Sometimes it’s the wise one, and sometimes it isn’t. Notice which.",
  "When it looks like only two options, look once more. There’s often a third.",
  "Separate what you know from what you fear. They can feel the same, but they aren’t.",
  "You rarely get perfect information. Enough information is usually enough.",
  "A choice you own, even an imperfect one, teaches you more than one you drifted into.",
  "Urgent and important aren’t the same thing. Today, notice which is which.",
  "If a decision feels heavy, it may be touching something you value. That’s worth knowing.",
  "Ask what you’d tell a friend in your place, then see whether you believe it for yourself.",
  "Pause long enough to hear your own answer under everyone else’s.",
  "A good decision can still have a bad outcome. Judge the deciding, not just the luck.",
  "What would you need to see to change your mind? Knowing that is a kind of clarity.",
  "Not deciding yet is fine. Not noticing you’re deciding is the part to watch.",
  "Small choices made with care add up to a life you recognize.",
  "Before you say yes, ask what it means you’re saying no to.",
  "Uncertainty isn’t a sign you’re doing it wrong. It’s the normal weather of real choices.",
  "Notice the first story you tell yourself about a problem. Then ask if it’s the only one.",
  "Evidence first, then feelings, then choice. All three belong; the order helps.",
  "You can take a step without knowing every step after it.",
  "Whatever you choose today, choose it on purpose.",
  "A hard conversation handled slowly is often better than an easy one handled fast.",
  "When you feel rushed to decide, it’s fair to ask who set the clock.",
  "Today, try asking one more question before you settle on an answer.",
  "What did your last good decision have in it? Bring a little of that forward.",
  "Your values aren’t a rulebook. They’re a compass. Check it before the turn.",
  "Most decisions can be revisited. Knowing which ones can’t is worth a pause.",
  "Doing nothing is an option worth naming, so you can choose it or not on purpose.",
  "Facts can wait a minute for you to breathe. Feelings usually settle if you let them.",
  "A decision made tired is still yours, but it may deserve a second look tomorrow.",
  "What would ‘good enough’ look like here? Sometimes that’s the real target.",
  "Notice who else your choice touches. Their view is evidence too.",
  "Every option costs something. Seeing the cost clearly is not the same as being stuck.",
  "You’re allowed to learn your way into a choice instead of knowing it up front.",
  "If you can’t decide, try naming what you’re afraid of losing. It often points the way.",
  "Good decisions are often quiet. They don’t need to feel dramatic to be right for you.",
  "Let today’s choices be yours, not just the ones that were easiest to say yes to.",
  "When an answer comes too fast, it’s fine to check where it came from.",
  "Look for what you can test small before you commit big.",
  "The best choice for someone else might not be the best one for you. Both can be true.",
  "Mistakes in choosing are information, not verdicts.",
  "Before you decide, notice how your body feels about each option. That counts as data.",
  "You can be decisive and still be open to learning you were wrong.",
  "Pause, notice, ask, then choose. Today, one of those is probably enough."
]);

export const INTENTION_PROMPT = "A decision I want to handle well today";
export const INTENTION_CHIPS = Object.freeze(["A conversation", "Money", "Time / priorities", "Health", "Nothing big — just stay present"]);

function dayNumber(date) {
  const d = new Date(date);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
export function lineIndexForDate(date = new Date(), size = LINES.length) {
  return ((((dayNumber(date) + 7) * STEP) % size) + size) % size;
}
export function lineForDate(date = new Date()) { return LINES[lineIndexForDate(date)]; }

/** Only called on an explicit Save. */
export function createMorningEntry({ line, intention }, now = new Date(), id = crypto.randomUUID()) {
  const text = cleanText(intention, 300);
  if (!text) throw new Error("Pick or write one decision, or tap Not today.");
  if (eveningSafety(text) === "crisis") throw new Error("crisis");
  const entry = { id, kind: "morning", version: 1, createdAt: now.toISOString(), day: dayKey(now),
    source: "Saved by you from a morning intention on this device", line: cleanText(line, 300), intention: text };
  return { ...entry, originalText: `This morning: ${entry.line}\nA decision I want to handle well: ${text}` };
}

/** Today's saved intention, if any (the latest one wins). */
export function morningIntentionFor(journal, now = new Date()) {
  const today = dayKey(now);
  return (journal || []).find(e => e.kind === "morning" && e.day === today)?.intention || "";
}
