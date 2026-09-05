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
 * Which action to offer, given who you are and what you have already done.
 *
 * Least-recently-used within the type's own pool, so a returning user works
 * through the whole set before anything repeats. `recentTags` is oldest-first,
 * exactly as `entries` is stored.
 */
export function chooseAction(personality: PersonalityType, recentTags: readonly string[]): number {
  const eligible = actionsFor(personality);
  const lastUsedAt = (index: number) => {
    const tag = actionTemplates[index]!.tag;
    const at = recentTags.lastIndexOf(tag);
    return at === -1 ? -1 : at;
  };
  return eligible.reduce((best, index) => (lastUsedAt(index) < lastUsedAt(best) ? index : best), eligible[0]!);
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
