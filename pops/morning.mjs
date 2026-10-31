// Morning inspiration: one line per day about deciding well (POPS + VALUE lens), plus an optional intention.
// Deterministic by date, so there's no server and no network. Lines are original to POPS.
// Nothing is stored unless the person taps Save.
import { cleanText } from "./logic.mjs";
import { dayKey, eveningSafety } from "./evening.mjs";

export const MORNING_KEYS = Object.freeze({ settings: "pops.morning.v1" });
export const DEFAULT_MORNING_REMINDER = "07:00";
const STEP = 17; // coprime with the bank size, so no line repeats within LINES.length days

export const MANTRAS = Object.freeze([
  { t: "Before you react today, give yourself one breath. The choice will still be there, and so will you.", tags: ["rushed", "stressed", "people"] },
  { t: "Name what matters before you weigh the options. It makes the weighing honest.", tags: ["calm", "big"] },
  { t: "Waiting is a choice too. Sometimes it’s the wise one, and sometimes it isn’t. Notice which.", tags: ["big", "anxious"] },
  { t: "When it looks like only two options, look once more. There’s often a third.", tags: ["big", "work"] },
  { t: "Separate what you know from what you fear. They can feel the same, but they aren’t.", tags: ["anxious", "stressed"] },
  { t: "You rarely get perfect information. Enough information is usually enough.", tags: ["big", "anxious", "money"] },
  { t: "A choice you own, even an imperfect one, teaches you more than one you drifted into.", tags: ["big", "calm"] },
  { t: "Urgent and important aren’t the same thing. Today, notice which is which.", tags: ["busy", "time", "work"] },
  { t: "If a decision feels heavy, it may be touching something you value. That’s worth knowing.", tags: ["big", "stressed"] },
  { t: "Ask what you’d tell a friend in your place, then see whether you believe it for yourself.", tags: ["people", "big"] },
  { t: "Pause long enough to hear your own answer under everyone else’s.", tags: ["people", "calm"] },
  { t: "A good decision can still have a bad outcome. Judge the deciding, not just the luck.", tags: ["big", "hopeful"] },
  { t: "What would you need to see to change your mind? Knowing that is a kind of clarity.", tags: ["big", "hopeful"] },
  { t: "Not deciding yet is fine. Not noticing you’re deciding is the part to watch.", tags: ["calm", "big"] },
  { t: "Small choices made with care add up to a life you recognize.", tags: ["calm", "low", "rest"] },
  { t: "Before you say yes, ask what it means you’re saying no to.", tags: ["time", "people", "work"] },
  { t: "Uncertainty isn’t a sign you’re doing it wrong. It’s the normal weather of real choices.", tags: ["anxious", "big"] },
  { t: "Notice the first story you tell yourself about a problem. Then ask if it’s the only one.", tags: ["stressed", "people"] },
  { t: "Evidence first, then feelings, then choice. All three belong; the order helps.", tags: ["calm", "work"] },
  { t: "You can take a step without knowing every step after it.", tags: ["low", "hopeful", "big"] },
  { t: "Whatever you choose today, choose it on purpose.", tags: ["calm", "hopeful"] },
  { t: "A hard conversation handled slowly is often better than an easy one handled fast.", tags: ["people", "stressed"] },
  { t: "When you feel rushed to decide, it’s fair to ask who set the clock.", tags: ["rushed", "busy", "time"] },
  { t: "Today, try asking one more question before you settle on an answer.", tags: ["calm", "work"] },
  { t: "What did your last good decision have in it? Bring a little of that forward.", tags: ["hopeful", "low"] },
  { t: "Your values aren’t a rulebook. They’re a compass. Check it before the turn.", tags: ["calm", "big"] },
  { t: "Most decisions can be revisited. Knowing which ones can’t is worth a pause.", tags: ["big", "money"] },
  { t: "Doing nothing is an option worth naming, so you can choose it or not on purpose.", tags: ["rest", "calm", "time"] },
  { t: "Facts can wait a minute for you to breathe. Feelings usually settle if you let them.", tags: ["rushed", "stressed"] },
  { t: "A decision made tired is still yours, but it may deserve a second look tomorrow.", tags: ["time", "busy", "low"] },
  { t: "What would ‘good enough’ look like here? Sometimes that’s the real target.", tags: ["low", "health"] },
  { t: "Notice who else your choice touches. Their view is evidence too.", tags: ["people"] },
  { t: "Every option costs something. Seeing the cost clearly is not the same as being stuck.", tags: ["money", "big", "time"] },
  { t: "You’re allowed to learn your way into a choice instead of knowing it up front.", tags: ["hopeful", "big"] },
  { t: "If you can’t decide, try naming what you’re afraid of losing. It often points the way.", tags: ["anxious", "big"] },
  { t: "Good decisions are often quiet. They don’t need to feel dramatic to be right for you.", tags: ["calm", "low"] },
  { t: "Let today’s choices be yours, not just the ones that were easiest to say yes to.", tags: ["busy", "time"] },
  { t: "When an answer comes too fast, it’s fine to check where it came from.", tags: ["anxious", "rushed"] },
  { t: "Look for what you can test small before you commit big.", tags: ["big", "money", "health"] },
  { t: "The best choice for someone else might not be the best one for you. Both can be true.", tags: ["people", "big"] },
  { t: "Mistakes in choosing are information, not verdicts.", tags: ["low", "hopeful"] },
  { t: "Before you decide, notice how your body feels about each option. That counts as data.", tags: ["health", "anxious"] },
  { t: "You can be decisive and still be open to learning you were wrong.", tags: ["hopeful", "work"] },
  { t: "Pause, notice, ask, then choose. Today, one of those is probably enough.", tags: ["calm", "busy"] },
  { t: "Rushing makes every option look the same. Slow down just enough to see them.", tags: ["rushed", "busy"] },
  { t: "If you only have a minute, spend it naming what matters most.", tags: ["rushed", "time", "busy"] },
  { t: "Fast is fine for small things. Save your slowness for the one that counts.", tags: ["rushed", "busy", "work"] },
  { t: "Anxiety predicts. Evidence reports. Listen to both, but know which is which.", tags: ["anxious", "big"] },
  { t: "You don’t have to solve the whole worry today, just the next honest step of it.", tags: ["anxious", "stressed"] },
  { t: "On a low day, a smaller choice made kindly is still a good choice.", tags: ["low", "rest"] },
  { t: "Low energy is evidence too. Let it shape what you take on, not what you think of yourself.", tags: ["low", "health", "time"] },
  { t: "Hope is a good reason to look for options. It’s not a reason to skip the look.", tags: ["hopeful", "big"] },
  { t: "Under stress, the loudest option isn’t always the wisest. Give the quiet ones a turn.", tags: ["stressed", "work"] },
  { t: "When the day is full, decide what can wait before you decide what can’t.", tags: ["busy", "time", "stressed"] },
  { t: "A calm morning is a good time to look at the decision you’ve been avoiding.", tags: ["calm", "big"] },
  { t: "In a conversation, you can choose to understand before you choose to answer.", tags: ["people", "stressed"] },
  { t: "With money, write down what you know and what you’re guessing. Then decide.", tags: ["money", "anxious"] },
  { t: "Your body has a vote in today’s choices. Let it speak before you overrule it.", tags: ["health", "low"] },
  { t: "Personal time is still time you get to choose. Notice what you want from it.", tags: ["rest", "calm", "time"] },
  { t: "At work, ask which decision is actually yours to make, then make that one well.", tags: ["work", "busy"] },
  { t: "A big decision deserves sleep, a second view, and your values in the room.", tags: ["big", "anxious"] },
  { t: "Not every meeting needs a decision. Notice which ones really do.", tags: ["work", "busy", "time"] }
]);
export const LINES = Object.freeze(MANTRAS.map(m => m.t));

export const INTENTION_PROMPT = "A decision I want to handle well today";
export const MOOD_PROMPT = "How are you arriving this morning?";
export const MORNING_MOODS = Object.freeze(["Calm", "Rushed", "Anxious", "Low energy", "Hopeful", "Heavy / stressed"]);
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
export function createMorningEntry({ line, intention, mood }, now = new Date(), id = crypto.randomUUID()) {
  const text = cleanText(intention, 300), feel = cleanText(mood, 80);
  if (!text && !feel) throw new Error("Pick a mood or a decision, or tap Not today.");
  if (eveningSafety([text, feel].filter(Boolean)) === "crisis") throw new Error("crisis");
  const entry = { id, kind: "morning", version: 1, createdAt: now.toISOString(), day: dayKey(now),
    source: "Saved by you from a morning check-in on this device", line: cleanText(line, 300), intention: text, mood: feel };
  return { ...entry, originalText: [`This morning: ${entry.line}`, feel && `Arriving: ${feel}`, text && `A decision I want to handle well: ${text}`].filter(Boolean).join("\n") };
}

/** Today's saved intention, if any (the latest one wins). */
export function morningIntentionFor(journal, now = new Date()) {
  const today = dayKey(now);
  return (journal || []).find(e => e.kind === "morning" && e.day === today && e.intention)?.intention || "";
}
export function morningMoodFor(journal, now = new Date()) {
  const today = dayKey(now);
  return (journal || []).find(e => e.kind === "morning" && e.day === today && e.mood)?.mood || "";
}

// ---- Context-aware mantra: mood > intention > calendar > focus > weekday/weekend > date rotation
const MOOD_TAGS = [[/rush|hurr|late|behind/i, "rushed"], [/anx|worr|nerv|scared|afraid|uneasy/i, "anxious"], [/low|tired|drained|exhaust|sad|flat/i, "low"],
  [/heavy|stress|overwhelm|tense|pressure/i, "stressed"], [/hope|excit|optimis|good|energ/i, "hopeful"], [/calm|steady|rested|fine|ok|peace/i, "calm"]];
const SITUATION_TAGS = [[/conversation|talk|call with|partner|friend|family|kid|boss|team|people|dinner|coffee|lunch with/i, "people"],
  [/money|budget|pay|bill|spend|buy|price|invest|rent|mortgage|salary/i, "money"], [/time|priorit|schedule|deadline|plan/i, "time"],
  [/health|doctor|dentist|gym|workout|run|sleep|therap|appointment|walk/i, "health"], [/big|move|job offer|quit|career|marry|house|decid/i, "big"],
  [/work|meeting|sync|standup|review|client|project|office|1:1/i, "work"], [/personal time|rest|relax|day off|vacation|weekend|nothing big/i, "rest"]];
export const TAG_LABELS = Object.freeze({ rushed: "a rushed morning", anxious: "an anxious morning", low: "a low-energy morning", stressed: "a heavy morning",
  hopeful: "a hopeful morning", calm: "a calm morning", people: "a day with people in it", money: "a money decision", time: "a day of priorities",
  health: "looking after your health", big: "a big decision", busy: "a busy day", rest: "personal time", work: "a work day" });
const match = (text, table) => table.filter(([re]) => re.test(text || "")).map(([, tag]) => tag);

/** Ordered context tags, highest priority first; each level weighted so it outranks everything below it. */
export function mantraContext({ mood = "", intention = "", events = [], focus = "", date = new Date() } = {}) {
  const levels = [match(mood, MOOD_TAGS), match(intention, SITUATION_TAGS).concat(/nothing big|present/i.test(intention) ? ["calm"] : []),
    [...(events.length >= 4 ? ["busy"] : []), ...match(events.join(" "), SITUATION_TAGS)], match(focus, SITUATION_TAGS),
    [[0, 6].includes(new Date(date).getDay()) ? "rest" : "work"]];
  return levels.map((tags, i) => ({ tags: [...new Set(tags)], weight: 2 ** (levels.length - i) * 10 }));
}

/** Deterministic: same day + same context → same mantra. `offset` steps through the matching set (tap for another). */
export function selectMantra(context = {}, offset = 0) {
  const date = context.date || new Date();
  const levels = mantraContext({ ...context, date });
  const contextual = levels.slice(0, -1).some(l => l.tags.length);
  if (!contextual) {
    const i = (lineIndexForDate(date) + offset) % MANTRAS.length;
    return { text: MANTRAS[i].t, tag: "", reason: "", pool: MANTRAS.length };
  }
  const scored = MANTRAS.map((m, i) => ({ i, m, score: levels.reduce((sum, l) => sum + l.tags.filter(t => m.tags.includes(t)).length * l.weight, 0) }));
  const best = Math.max(...scored.map(x => x.score));
  const pool = scored.filter(x => x.score === best);
  const pick = pool[(((dayNumber(date) * 7 + offset) % pool.length) + pool.length) % pool.length];
  const tag = levels.flatMap(l => l.tags).find(t => pick.m.tags.includes(t)) || "";
  return { text: pick.m.t, tag, reason: tag ? `for ${TAG_LABELS[tag]}` : "", pool: pool.length };
}
