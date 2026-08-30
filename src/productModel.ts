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
    quote: "i need to know this will be worth it before i try.",
    pattern:
      "you measure today by what it builds toward. the future never quite arrives — there's always another milestone between here and enough.",
    traits: ["driven", "efficient", "goal-oriented", "adaptable"]
  },
  seeker: {
    name: "the seeker",
    quote: "i need my life to mean something — but i'm not sure it does.",
    pattern:
      "you're not afraid of failure. you're afraid of becoming someone whose life didn't mean what it could have.",
    traits: ["emotionally deep", "creative", "self-aware", "perceptive"]
  },
  planner: {
    name: "the planner",
    quote: "i need to be prepared for everything that could go wrong.",
    pattern:
      "you don't avoid commitment because you're indecisive. committing fully feels like leaving yourself exposed. so you cover all bases.",
    traits: ["loyal", "responsible", "committed", "determined"]
  }
} as const;

export type PersonalityType = keyof typeof personalityTypes;

export type GrowthStage = "seed" | "sapling" | "tree";

/** Growth follows actions, never days — emotional labour, not time served. */
export function stageFor(actionsDone: number): GrowthStage {
  if (actionsDone <= 0) return "seed";
  if (actionsDone < 3) return "sapling";
  return "tree";
}
