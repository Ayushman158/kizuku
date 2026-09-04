# 004 — Give the type reveal the one moment it only gets once

- **Status**: DONE — implemented and verified on 2026-09-04 (web). Reduced motion still owed, see below.
- **Commit**: 34c481c
- **Severity**: MEDIUM
- **Category**: Purpose & frequency (AUDIT §1)
- **Estimated scope**: 1 file, ~30 lines

## Problem

`RevealScreen` is where the app tells you who you are. It is the payoff of the onboarding
quiz, it is seen **exactly once per user, ever**, and it has **zero** animation — it cuts in
fully formed, all at once.

AUDIT §1 puts frequency at the centre of whether motion is worth it: a keyboard action
repeated 100 times a day should never animate, and a rare first-run moment is precisely
where delight is affordable. This is the rarest screen in the product.

The whole onboarding is motionless — `WelcomeScreen` (lines 1002–1024), `QuizScreen`
(1025–1093) and `RevealScreen` (1094–1135) contain **0** `Animated.` calls between them —
but the reveal is the one that carries a payoff, so it is the one worth spending on.

`src/KizukuApp.tsx:1104-1113` — current, static:

```tsx
  return (
    <View style={[styles.flex, { backgroundColor: theme.surface }]}>
      <ScrollView contentContainerStyle={styles.revealContent} showsVerticalScrollIndicator={false}>
        <View style={styles.revealEmblem}>
          <TypeEmblem personality={personality} ink={theme.ink} edge={theme.edge} />
        </View>

        <Text style={[styles.eyebrow, { color: theme.ink }]}>your type</Text>
        <Text style={[styles.revealName, { color: theme.ink }]}>{type.name}</Text>
        <Text style={[styles.revealQuote, { color: theme.ink }]}>“{type.quote}”</Text>
```

followed by the pattern card (`:1115-1118`), the trait tags (`:1120-1127`) and the
`meet your plant` button (`:1131-1133`).

## Target

A short staggered arrival, in the order a person reads it: emblem, then name, then quote,
then pattern card, then traits. Nothing bounces — this is a calm product, and the arrival
should feel like something settling, not springing.

**One driver, five delays.** Add a single `Animated.Value` and stagger by interpolating it
per element, so there is one animation to reason about and one to cancel:

```tsx
const reveal = useRef(new Animated.Value(0)).current;
const reduceMotion = useReduceMotionPreference();

useEffect(() => {
  reveal.setValue(reduceMotion ? 1 : 0);
  if (reduceMotion) return;

  Animated.timing(reveal, {
    toValue: 1,
    duration: 1100,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true
  }).start();
}, [reveal, reduceMotion]);

// each element opens over its own slice of the same 0..1 timeline
const step = (from: number, to: number) => ({
  opacity: reveal.interpolate({ inputRange: [from, to], outputRange: [0, 1], extrapolate: "clamp" }),
  transform: [{
    translateY: reveal.interpolate({ inputRange: [from, to], outputRange: [14, 0], extrapolate: "clamp" })
  }]
});
```

**Exact slices** (of the 0–1 timeline; do not change these ratios):

| Element | `step(from, to)` |
| --- | --- |
| Emblem | `step(0, 0.34)` |
| `your type` + name | `step(0.16, 0.52)` |
| Quote | `step(0.30, 0.66)` |
| Pattern card | `step(0.44, 0.80)` |
| Trait tags | `step(0.56, 0.92)` |

Wrap each in an `Animated.View` with `{...step(a, b)}` spread onto its style array. The
`meet your plant` button at `:1131-1133` stays **unanimated and immediately tappable** — a
user who has read the quiz already should never wait for choreography to continue.

**The emblem gets one extra beat**, since it is the only illustration on the screen:

```tsx
const emblemScale = reveal.interpolate({
  inputRange: [0, 0.34], outputRange: [0.92, 1], extrapolate: "clamp"
});
```

`0.92 → 1`, never from `0` (AUDIT §3: nothing in the real world appears from nothing).

**Reduced motion**: `setValue(1)` and return before starting — everything is present,
opaque and unmoved on first paint. Do not substitute a fade.

## Repo conventions to follow

- **Exemplar to imitate: `src/KizukuApp.tsx:287-296`** (`HomeScreen`'s `promptEntrance`) —
  `setValue` first, `if (reduceMotion) return`, one `Animated.timing`, native driver.
- **`useReduceMotionPreference()`** at `src/KizukuApp.tsx:82-91` is the house hook.
- **Easing**: `Easing.out(Easing.cubic)` is what every entrance in this file uses
  (`:294`, `:345`, `:746`, `HoldButton.tsx:48`). Use it; do not introduce a new curve.
- **Springs**: `motion.growSpring` exists (`src/tokens.ts`) and is documented as
  *"slow, deliberate, barely overshooting — alive, not springy"*. It is for the plant rising.
  Do **not** use it here; a timing curve is right for text arriving.
- The 1100ms total is screen-specific and stays inline. Do not add it to `motion`.

## Steps

1. In `src/KizukuApp.tsx`, inside `RevealScreen` (function starts at line 1094), add the
   `reveal` ref, the `reduceMotion` hook, the `useEffect`, the `step()` helper and
   `emblemScale` from *Target*.
2. Wrap the emblem `View` (`:1107-1109`) in an `Animated.View` carrying `step(0, 0.34)` and
   add `{ scale: emblemScale }` to its transform array alongside the `translateY`.
3. Wrap the `your type` + name pair (`:1111-1112`) in one `Animated.View` with
   `step(0.16, 0.52)` — they are one unit and must not separate.
4. Wrap the quote (`:1113`) with `step(0.30, 0.66)`.
5. Wrap the pattern card (`:1115-1118`) with `step(0.44, 0.80)`.
6. Wrap the trait tags container (`:1120-1127`) with `step(0.56, 0.92)` — the container, not
   each tag. Staggering nine individual tags would over-egg a calm screen.
7. Leave the `bottomAction` button (`:1131-1133`) exactly as it is.

## Boundaries

- **Do NOT animate `WelcomeScreen` or `QuizScreen`.** The quiz is answered three times in a
  row and animating it would put motion on a repeated action — the opposite of AUDIT §1.
  This plan is the reveal only.
- Do NOT stagger the individual trait tags.
- Do NOT animate the `meet your plant` button, and do not delay its interactivity.
- Do NOT change copy, colours, `theme` values, layout or spacing.
- Do NOT use a spring, and do not add bounce. `motion.growSpring` belongs to the plant.
- Do NOT animate `backgroundColor` or anything else off the native driver — `opacity` and
  `transform` only.
- Do NOT add dependencies.
- If a step does not match the code you find (drift since commit `34c481c`), STOP and report.

## Verification

**Mechanical**
- `cd ~/Kizuku-app && npx tsc --noEmit` — expect no new errors.
- `grep -n "useNativeDriver: false" src/KizukuApp.tsx` — expect no matches (plan `002` clears
  the only one; do not reintroduce it here).

**Feel check**
- Run onboarding end to end and reach the reveal. Elements must arrive **in reading order**:
  emblem, name, quote, pattern, traits. If anything arrives out of order the slices were
  transcribed wrong.
- Total settle must be **~1.1s**. If it feels like waiting, it is too slow — but do not fix
  that by shortening below 900ms; check first that the button was tappable throughout.
- **Tap `meet your plant` the instant the screen appears.** It must work immediately, before
  the traits have arrived. This is the one hard requirement: ceremony must never gate.
- The emblem must scale `0.92 → 1`, not pop from nothing. In slow motion it should already
  have a visible size in its first frame.
- Nothing should overshoot or bounce.
- Enable reduced motion and repeat: the whole screen is present and opaque on first paint,
  no movement, no stagger.
- Run all three types (`optimizer`, `seeker`, `planner`) — the quote is the longest line and
  differs per type; confirm none of them reflow or clip as they arrive.

**Done when**
- The reveal arrives in five staggered beats over ~1.1s, in reading order, with no bounce.
- The continue button is tappable from the first frame.
- Reduced motion shows everything instantly.
- Welcome and quiz are still motionless.

---

## Execution record (2026-09-04)

Implemented in `RevealScreen` only. `WelcomeScreen` and `QuizScreen` were left alone, as the
Boundaries require.

**Passed**
- `npx tsc --noEmit` → exit 0.
- Boundary sweep: `Animated.` count is Welcome **0**, Quiz **0**, Reveal **12** — the
  ceremony landed on the once-ever screen and nowhere else. No spring introduced, no
  `useNativeDriver: false`.
- **The stagger is real.** Sampling every fading wrapper during the run gave
  `[0.75, 0.27, 0, 0, 0, 0]` on the first frame — the emblem already three-quarters in, the
  name a quarter in, the last three untouched — and the set shrank 6 → 5 → 3 → 2 → 1 → 0 as
  each element settled. That is arrival in reading order.
- **The continue button is live from the first frame.** Sampled *during* the animation:
  `opacity: 1`, no fading ancestor, and `elementFromPoint` at its centre resolves to the
  button. This was the plan's one hard requirement — ceremony must never gate the way out.
- Settled state is clean on all three types: zero elements left below opacity 1.
- No reflow or clipping across types — quote height is 26px for `optimizer` and 52px for
  `seeker` and `planner` (their quotes wrap to two lines), and all three lay out correctly.

**Correction to this plan's own text**
- *Steps* step 6 says "nine individual tags". There are **four** trait tags, not nine. The
  decision is unaffected — the container is animated, not its children — but the number was
  wrong.

**Not verified here — still owed**
- **Reduced motion.** The branch matches `HomeScreen`'s proven `setValue(1)`-then-return
  path, but `prefers-reduced-motion` could not be toggled in this browser, so it was not
  exercised. Same gap as plans 002 and 003; worth clearing all three in one on-device pass.
