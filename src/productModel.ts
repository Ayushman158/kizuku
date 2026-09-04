export const actionTemplates = [
  {
    tag: "reach out",
    text: "send a message to the one person you have been meaning to reply to for days. not tomorrow. right now, before you close this app."
  },
  {
    tag: "sit still",
    text: "set a 3-minute timer. sit. don't fix anything. just notice the shape of what's here."
  },
  {
    tag: "reframe",
    text: "write your worry as a question. then close the notebook. the question will do its own work."
  },
  {
    tag: "look out",
    text: "walk to the nearest window. find three things outside that haven't changed today."
  },
  {
    tag: "start",
    text: "open the file you've been avoiding. write a single sentence. close it again. that counts."
  },
  {
    tag: "ask",
    text: "send one honest question to someone you trust. no preamble. you're allowed to want answers."
  }
] as const;

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
    traits: ["driven", "efficient", "goal-oriented", "adaptable"]
  },
  seeker: {
    name: "the seeker",
    /** the plant this type grows, and the thing they are naming */
    plant: "crystal tree",
    quote: "i need my life to mean something — but i'm not sure it does.",
    pattern:
      "you're not afraid of failure. you're afraid of becoming someone whose life didn't mean what it could have.",
    traits: ["emotionally deep", "creative", "self-aware", "perceptive"]
  },
  planner: {
    name: "the planner",
    /** the plant this type grows, and the thing they are naming */
    plant: "strata tree",
    quote: "i need to be prepared for everything that could go wrong.",
    pattern:
      "you don't avoid commitment because you're indecisive. committing fully feels like leaving yourself exposed. so you cover all bases.",
    traits: ["loyal", "responsible", "committed", "determined"]
  }
} as const;

export type PersonalityType = keyof typeof personalityTypes;

/**
 * Two states, because two are drawn: the hi-fi file gives every type a day-0
 * seed and a grown plant, and nothing in between. A middle stage exists as
 * artwork for the optimiser only, so shipping three would break the other two.
 */
export type GrowthStage = "seed" | "grown";

/** Growth follows actions, never days — emotional labour, not time served. */
export function stageFor(actionsDone: number): GrowthStage {
  return actionsDone <= 0 ? "seed" : "grown";
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
