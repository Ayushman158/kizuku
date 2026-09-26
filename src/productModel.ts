/**
 * Every action the app can hand someone, tagged with the types it serves.
 *
 * `types` is the load-bearing field. Before it existed the app ran the worry
 * through a character-code hash and handed back `sum % 6` — so the quiz, the
 * reveal and the naming ritual established a type that then changed nothing but
 * colours and artwork. An optimiser and a seeker with the same worry got the
 * same instruction.
 *
 * The mapping is not a mood match. It is what each type most needs and least
 * volunteers for: the optimiser is asked to stop measuring, the planner to act
 * without cover, the seeker to make meaning rather than wait to find it.
 */
export const actionTemplates = [
  {
    tag: "reach out",
    types: ["seeker", "planner"],
    text: "send a message to the one person you have been meaning to reply to for days. not tomorrow. right now, before you close this app."
  },
  {
    tag: "sit still",
    types: ["optimizer", "planner"],
    text: "set a 3-minute timer. sit. don't fix anything. just notice the shape of what's here."
  },
  {
    tag: "reframe",
    types: ["planner", "seeker", "optimizer"],
    text: "write your worry as a question. then close the notebook. the question will do its own work."
  },
  {
    tag: "look out",
    types: ["optimizer", "seeker"],
    text: "walk to the nearest window. find three things outside that haven't changed today."
  },
  {
    tag: "start",
    types: ["planner", "optimizer"],
    text: "open the file you've been avoiding. write a single sentence. close it again. that counts."
  },
  {
    tag: "ask",
    types: ["seeker", "planner"],
    text: "send one honest question to someone you trust. no preamble. you're allowed to want answers."
  },
  {
    tag: "stop early",
    types: ["optimizer"],
    text: "take the thing you were saving to do properly later. do a rough version now, in five minutes, badly. leave it that way."
  },
  {
    tag: "say why",
    types: ["seeker"],
    text: "write one sentence about why something you did this week mattered. not to anyone else. to you."
  },
  {
    tag: "leave it",
    types: ["planner"],
    text: "choose one thing on today's list and decide, now, not to do it. no backup plan. let it stay undone."
  }
] as const satisfies ReadonlyArray<{
  tag: string;
  types: ReadonlyArray<PersonalityType>;
  text: string;
}>;

/**
 * The three types the onboarding quiz assigns, with the traits and copy the
 * wireframe defines for each. Traits belong to the type — they are never
 * inferred from what someone wrote.
 */
export const personalityTypes = {
  optimizer: {
    name: "the optimiser",
    /** the plant this type grows, and the thing they are naming */
    plant: "spiral tree",
    quote: "i need to know this will be worth it before i try.",
    pattern:
      "you measure today by what it builds toward. the future never quite arrives — there's always another milestone between here and enough.",
    /** the patterns screen's headline. was one hardcoded line for all three. */
    headline: { lead: "you turn worry into", accent: "the next move." },
    /** closes the patterns screen. distinct from `quote`, which is the fear. */
    mantra: "enough is a decision, not a destination.",
    traits: ["driven", "efficient", "goal-oriented", "adaptable"]
  },
  seeker: {
    name: "the seeker",
    /** the plant this type grows, and the thing they are naming */
    plant: "crystal tree",
    quote: "i need my life to mean something — but i'm not sure it does.",
    pattern:
      "you're not afraid of failure. you're afraid of becoming someone whose life didn't mean what it could have.",
    headline: { lead: "you turn worry into", accent: "a question of meaning." },
    mantra: "meaning is made, not found.",
    traits: ["emotionally deep", "creative", "self-aware", "perceptive"]
  },
  planner: {
    name: "the planner",
    /** the plant this type grows, and the thing they are naming */
    plant: "strata tree",
    quote: "i need to be prepared for everything that could go wrong.",
    pattern:
      "you don't avoid commitment because you're indecisive. committing fully feels like leaving yourself exposed. so you cover all bases.",
    headline: { lead: "you turn worry into plans.", accent: "step by step." },
    mantra: "you can only prepare for so much. then you begin.",
    traits: ["loyal", "responsible", "committed", "determined"]
  }
} as const;

export type PersonalityType = keyof typeof personalityTypes;

/**
 * Six stages, drawn for all three trees in the design file — 18 illustrations
 * under assets/stages. This used to be two, "seed" and "grown", which meant the
 * plant reached its final form after a single action and the metaphor was spent
 * on day one.
 */
export type GrowthStage = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Actions needed to reach each stage. Growth follows actions, never days —
 * emotional labour, not time served.
 *
 * The curve opens fast and then lengthens: the second stage arrives on the very
 * first action, so nobody waits to see that this responds to them, and the last
 * one lands at 30 to meet the 30-day milestone the brand deck already commits
 * to. Missing a day costs nothing; the tree records what you did.
 */
export const stageThresholds = [0, 1, 3, 7, 14, 30] as const;

export function stageFor(actionsDone: number): GrowthStage {
  let stage: GrowthStage = 1;
  stageThresholds.forEach((needed, index) => {
    if (actionsDone >= needed) stage = (index + 1) as GrowthStage;
  });
  return stage;
}

/** How many more actions until the plant changes, or null once fully grown. */
export function actionsUntilNextStage(actionsDone: number): number | null {
  const next = stageThresholds.find((needed) => needed > actionsDone);
  return next === undefined ? null : next - actionsDone;
}

/** The actions this type is ever offered. Never empty — every type has four. */
export function actionsFor(personality: PersonalityType): number[] {
  return actionTemplates
    .map((template, index) => ({ template, index }))
    .filter(({ template }) => (template.types as readonly string[]).includes(personality))
    .map(({ index }) => index);
}

/**
 * Cues that make a worry point at one action rather than another.
 *
 * This is deliberately shallow — word spotting, not comprehension. It runs on
 * the raw text in memory and nothing is stored or sent anywhere. It is used as
 * a preference between actions the type already allows, never as an override,
 * so a worry that matches nothing simply falls through to rotation and the app
 * behaves exactly as it did before. A wrong guess costs a slightly less apt
 * suggestion; it cannot produce an action the type would not have been given.
 */
const cues: Record<string, readonly string[]> = {
  "reach out": ["someone", "friend", "family", "message", "text", "call", "reply", "replied",
    "alone", "lonely", "partner", "mum", "dad", "brother", "sister", "everyone"],
  "sit still": ["spiral", "spiralling", "racing", "can't stop", "cant stop", "overwhelmed",
    "too much", "panic", "restless", "constantly", "won't stop", "wont stop"],
  reframe: ["what if", "never", "always", "disaster", "worst", "catastroph", "certain",
    "sure that", "convinced", "assume"],
  "look out": ["stuck", "same", "nothing changes", "trapped", "going nowhere", "control",
    "out of control"],
  start: ["avoid", "avoiding", "putting off", "procrastin", "deadline", "haven't started",
    "havent started", "should have", "behind"],
  ask: ["don't know", "dont know", "unsure", "wondering", "think of me", "thinks", "guess",
    "unclear", "maybe they"],
  "stop early": ["perfect", "properly", "good enough", "right way", "not ready", "polish",
    "get it right"],
  "say why": ["point", "pointless", "meaning", "meaningless", "matter", "matters", "worth",
    "why am i", "empty"],
  "leave it": ["list", "everything", "all of it", "juggling", "no time", "too many",
    "on top of"]
};

/** How strongly a worry points at one action. 0 when it says nothing about it. */
function cueScore(tag: string, worry: string): number {
  const text = worry.toLowerCase();
  return (cues[tag] ?? []).reduce((score, cue) => (text.includes(cue) ? score + 1 : score), 0);
}

/**
 * Which action to offer, given who you are, what you wrote, and what you have
 * already been given.
 *
 * Least-recently-used within the type's own pool, so a returning user works
 * through the whole set before anything repeats — and among equally fresh
 * actions, the one the worry points at wins. `recentTags` is oldest-first,
 * exactly as `entries` is stored, and includes declined actions: something you
 * turned down yesterday should not come straight back today.
 */
export function chooseAction(
  personality: PersonalityType,
  recentTags: readonly string[],
  worry = ""
): number {
  const eligible = actionsFor(personality);
  // Whatever you were handed last never comes straight back, however loudly the
  // worry points at it — a cue is a preference, not a reason to repeat yourself.
  const lastTag = recentTags[recentTags.length - 1];
  const fresh = eligible.filter((index) => actionTemplates[index]!.tag !== lastTag);
  const candidates = fresh.length > 0 ? fresh : eligible;

  const lastUsedAt = (index: number) => recentTags.lastIndexOf(actionTemplates[index]!.tag);
  const rank = (index: number): [number, number] => [
    cueScore(actionTemplates[index]!.tag, worry),
    -lastUsedAt(index)
  ];
  return candidates.reduce((best, index) => {
    const [cue, fresh] = rank(index);
    const [bestCue, bestFresh] = rank(best);
    if (cue !== bestCue) return cue > bestCue ? index : best;
    return fresh > bestFresh ? index : best;
  }, candidates[0]!);
}

/**
 * The real plant at thirty — the brand deck's promise that the digital
 * growth becomes something physical. The species per type are the deck's own
 * lists, each "chosen for psychological alignment, not aesthetics": the
 * optimiser's are fast and useful, the seeker's strange and meaningful, the
 * planner's patient and hard to get wrong. The one-line reasons are written
 * in the app's voice and say why this plant, for this person.
 */
export const realPlants = {
  optimizer: [
    { name: "pothos", why: "grows fast enough that you can watch it. progress you can measure." },
    { name: "basil", why: "useful as well as green. you will be cutting from it within a week." },
    { name: "spider plant", why: "sends out small plants of its own. growth that keeps paying back." },
    { name: "aloe vera", why: "asks for almost nothing, and is good for a burn." }
  ],
  seeker: [
    { name: "air plant", why: "needs no soil at all. it lives on air and a little attention." },
    { name: "nerve plant", why: "its veins show you exactly how it is doing, and it forgives you fast." },
    { name: "moon cactus", why: "two plants grafted into one. a small strange thing that means something." },
    { name: "string of pearls", why: "grows slowly, one bead at a time, each its own small decision." }
  ],
  planner: [
    { name: "bonsai", why: "rewards years of patience. nothing about it can be rushed." },
    { name: "zz plant", why: "almost impossible to get wrong. you can stop preparing." },
    { name: "jade plant", why: "lives for decades, and only grows as fast as it is sure." },
    { name: "snake plant", why: "does best when it is left alone, which is its own kind of trust." }
  ]
} as const satisfies Record<PersonalityType, ReadonlyArray<{ name: string; why: string }>>;

/**
 * Places to start, for someone who opens the worry screen and cannot name it.
 *
 * Finch puts suggestions under its goal box so an empty field is never the
 * whole screen. These are shaped differently on purpose: each is written
 * toward one action's cues, so tapping it is not a shortcut past the choice
 * but a real way into it — "a deadline i keep putting off" is picked up by
 * the same word-spotting that reads a typed worry, and points at start. It
 * points; it does not force. If start was the last action given, the
 * never-repeat rule wins and the next-best action comes back instead.
 *
 * They are offered only when the action they lead to is in the type's own
 * pool, so no suggestion ends somewhere this person would never be sent.
 * Lowercase and first person, because they are worded as the user's own.
 */
export const worryStarters = [
  { leadsTo: "start", text: "a deadline i keep putting off" },
  { leadsTo: "reach out", text: "a message i still haven't replied to" },
  { leadsTo: "reframe", text: "what if it all goes wrong" },
  { leadsTo: "leave it", text: "too many things on my list" },
  { leadsTo: "say why", text: "whether any of this matters" },
  { leadsTo: "ask", text: "what they think of me" },
  { leadsTo: "stop early", text: "it has to be perfect first" },
  { leadsTo: "sit still", text: "i can't stop running it in my head" },
  { leadsTo: "look out", text: "feeling stuck, like nothing changes" }
] as const;

export function startersFor(personality: PersonalityType, limit = 5): string[] {
  const pool = new Set(actionsFor(personality).map((index) => actionTemplates[index]!.tag as string));
  return worryStarters.filter((starter) => pool.has(starter.leadsTo)).slice(0, limit).map((starter) => starter.text);
}

/**
 * The next action when someone asks for a different one. Cycles inside the
 * type's pool — the old version stepped through all templates, so swapping
 * could hand a planner an action written for somebody else.
 */
export function nextAction(personality: PersonalityType, currentIndex: number): number {
  const eligible = actionsFor(personality);
  const at = eligible.indexOf(currentIndex);
  return eligible[(at + 1) % eligible.length]!;
}

/**
 * Three questions, in the wireframe's order. Each option belongs to a type;
 * the option order is planner, optimiser, seeker throughout.
 */
export const quiz = [
  {
    prompt: "sunday evening. big week ahead. what are you most likely doing?",
    options: [
      {
        text: "planning the week — time blocked, tasks listed, thinking about what could go wrong",
        type: "planner"
      },
      { text: "reviewing if i'm on track. checking what will move me forward.", type: "optimizer" },
      { text: "sitting with a vague feeling something isn't quite right", type: "seeker" }
    ]
  },
  {
    prompt: "a decision doesn't go as hoped. what's your first instinct?",
    options: [
      { text: "what did i miss? what would i do differently next time?", type: "planner" },
      { text: "what did it cost me? how do i recover and move forward fast?", type: "optimizer" },
      { text: "did i make this decision for the right reasons?", type: "seeker" }
    ]
  },
  {
    prompt: "what are you most honestly afraid of?",
    options: [
      { text: "committing to the wrong thing and having no backup", type: "planner" },
      { text: "wasting my potential on things that won't add up", type: "optimizer" },
      { text: "living a life that looked right but felt meaningless inside", type: "seeker" }
    ]
  }
] as const satisfies ReadonlyArray<{
  prompt: string;
  options: ReadonlyArray<{ text: string; type: PersonalityType }>;
}>;

/**
 * Most-chosen type wins. A three-way split is broken by the last answer:
 * the wireframe marks question three as the one that makes the result feel
 * earned, so it carries the most weight.
 */
export function typeFrom(answers: PersonalityType[]): PersonalityType {
  const tally = new Map<PersonalityType, number>();
  answers.forEach((answer) => tally.set(answer, (tally.get(answer) ?? 0) + 1));
  const top = Math.max(...tally.values());
  const leaders = [...tally.entries()].filter(([, count]) => count === top).map(([type]) => type);
  const last = answers[answers.length - 1];
  return leaders.length === 1 ? leaders[0]! : last ?? "optimizer";
}
