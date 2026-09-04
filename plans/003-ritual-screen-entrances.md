# 003 — Stop the daily ritual cutting between animated and static screens

- **Status**: DONE — implemented and verified on 2026-09-04 (web). Two checks still owed, see below.
- **Commit**: 34c481c
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens (AUDIT §7)
- **Estimated scope**: 1 file, ~20 lines — one shared wrapper, no per-screen edits

## Problem

The daily ritual alternates between screens that animate in and screens that hard-cut.
Counted across each function's full body in `src/KizukuApp.tsx`:

| Screen | Lines | `Animated.` calls |
| --- | --- | --- |
| `HomeScreen` (the garden) | 264–435 | 21 |
| **`WorryScreen`** | **436–496** | **0** |
| `ThinkingScreen` | 497–549 | 7 |
| **`ActionScreen`** | **550–595** | **0** |
| `CommittingScreen` | 596–642 | 10 |
| `GrowthScreen` | 711–825 | 9 |
| **`ReflectionScreen`** | **643–710** | **0** |

The three screens with no motion are the three that ask the user to **read something and
answer**: name a worry, accept an action, say what happened. The product's whole premise is
deliberate pacing, and those are the moments it snaps.

`HomeScreen` already has the treatment — `src/KizukuApp.tsx:287-296`:

```tsx
  useEffect(() => {
    promptEntrance.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;

    Animated.timing(promptEntrance, {
      toValue: 1,
      duration: motion.enterSoft,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
```

applied at `src/KizukuApp.tsx:367` and `:401`:

```tsx
  const promptTranslate = promptEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  ...
      <Animated.View
        style={[
          styles.homeCardMotion,
          { opacity: promptEntrance, transform: [{ translateY: promptTranslate }] }
        ]}
      >
```

**One edit fixes all three.** `GradientScreen` (`src/KizukuApp.tsx:1136-1149`) is the shared
wrapper, and it is used by exactly `WorryScreen:452`, `ActionScreen:566` and
`ReflectionScreen:665` — nothing else:

```tsx
function GradientScreen({
  personality,
  children
}: {
  personality: PersonalityType;
  children: React.ReactNode;
}) {
  return (
    <LinearGradient colors={themes[personality].ritual} style={styles.flex}>
      {children}
    </LinearGradient>
  );
}
```

## Target

Move the `HomeScreen` entrance into `GradientScreen` so every screen that uses it fades and
rises on mount, with the same token, curve and distance the garden already uses.

```tsx
function GradientScreen({
  personality,
  children
}: {
  personality: PersonalityType;
  children: React.ReactNode;
}) {
  const reduceMotion = useReduceMotionPreference();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;

    Animated.timing(entrance, {
      toValue: 1,
      duration: motion.enterSoft,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [entrance, reduceMotion]);

  const rise = entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <LinearGradient colors={themes[personality].ritual} style={styles.flex}>
      {/* The ritual screens used to hard-cut in while the garden faded and rose.
          Same token, same curve, same 24px as HomeScreen — one place, three screens. */}
      <Animated.View
        style={[styles.flex, { opacity: entrance, transform: [{ translateY: rise }] }]}
      >
        {children}
      </Animated.View>
    </LinearGradient>
  );
}
```

**Exact values — all already in the repo, do not invent new ones:**
- Duration: `motion.enterSoft` (= 650, `src/tokens.ts`). Do not hardcode 650.
- Easing: `Easing.out(Easing.cubic)`.
- Distance: `24 → 0` on `translateY`.
- Driver: `useNativeDriver: true`.
- Reduced motion: `setValue(1)` and return before starting — the screen appears instantly,
  fully opaque, unmoved. This matches `HomeScreen` and AUDIT §6 (drop movement, keep the
  content).

**Do not gradient-animate.** `LinearGradient` stays outside the `Animated.View` so the
background is painted immediately and only the content rises over it. Animating the gradient
itself would be a layout/paint animation and cannot use the native driver.

## Repo conventions to follow

- **Exemplar to imitate: `src/KizukuApp.tsx:287-296` and `:367`, `:401`** (`HomeScreen`'s
  `promptEntrance`). Copy its structure exactly: `setValue` first, `if (reduceMotion) return`,
  then a single `Animated.timing` on the native driver.
- **Motion durations come from `motion` in `src/tokens.ts`** — `enterSoft: 650` exists for
  precisely this.
- `useReduceMotionPreference()` is the house hook, defined at `src/KizukuApp.tsx:82-91`.
  Use it; do not call `AccessibilityInfo` directly in a new place.
- `useRef`, `useEffect`, `Animated`, `Easing` and `motion` are all already imported in this
  file. No new imports should be needed.

## Steps

1. In `src/KizukuApp.tsx`, replace the body of `GradientScreen` (lines 1136–1149) with the
   version in *Target*.
2. Verify no new imports are required (`useRef`, `useEffect`, `Animated`, `Easing`, `motion`,
   `useReduceMotionPreference` are all in scope in this file already).
3. Change nothing in `WorryScreen`, `ActionScreen` or `ReflectionScreen` — they inherit the
   entrance by being wrapped.

## Boundaries

- **Do NOT add entrances to `ThinkingScreen`, `CommittingScreen`, `GrowthScreen` or
  `HomeScreen`.** They already animate and use `LinearGradient` directly, not
  `GradientScreen` — touching them would double up the motion.
- Do NOT remove or alter `HomeScreen`'s `promptEntrance`. It animates one card inside the
  screen, which is a different job from the screen arriving; leave it.
- Do NOT change copy, layout, colours, spacing or the gradient colours.
- Do NOT extend this to onboarding (`WelcomeScreen`, `QuizScreen`, `RevealScreen`) — they do
  not use `GradientScreen` and are covered by plan `004`.
- Do NOT add dependencies.
- If a step does not match the code you find (drift since commit `34c481c`), STOP and report.

## Verification

**Mechanical**
- `cd ~/Kizuku-app && npx tsc --noEmit` — expect no new errors.
- `grep -n "<GradientScreen" src/KizukuApp.tsx` — expect exactly **three** matches
  (`WorryScreen`, `ActionScreen`, `ReflectionScreen`). If there are more, the blast radius
  changed and the Boundaries need re-reading before continuing.

**Feel check**
- Walk the full ritual: garden → worry → thinking → action → committing → growth →
  reflection. **No screen should snap in.** Before this change, worry, action and reflection
  did; that contrast is what you are checking has gone.
- The rise must be the *same weight* as the garden's — put them side by side. If the ritual
  screens feel faster or further, `motion.enterSoft` or the 24px was not used.
- On `WorryScreen`, `autoFocus` on the `TextInput` raises the keyboard as the screen enters.
  Confirm the entrance is not fighting the keyboard animation — the card should settle
  before or with the keyboard, never jitter against it. **This is the one real risk in this
  plan**; if it jitters, gate the entrance on `WorryScreen` only, and say so.
- `ReflectionScreen` wraps its content in a `ScrollView` (`KizukuApp.tsx:668`). Confirm the
  translate does not leave a 24px gap at the top or clip the first line on entry.
- Enable reduced motion and repeat: all three appear instantly, fully opaque, with no
  movement — and are still fully usable.

**Done when**
- Worry, action and reflection fade and rise on entry, indistinguishable in weight from the
  garden.
- The other four screens are untouched and animate exactly as before.
- Reduced motion shows all three instantly with no movement.
- The worry screen's keyboard and entrance do not fight.

---

## Execution record (2026-09-04)

One edit to `GradientScreen` in `src/KizukuApp.tsx`; the three consuming screens were not
touched and inherit the entrance by being wrapped.

**Passed**
- `npx tsc --noEmit` → exit 0.
- `grep -c "<GradientScreen"` → **3**, before and after. The precondition this plan rests on
  still holds; if it ever returns more than 3, the reasoning is void.
- `promptEntrance` still present (6 references) — `HomeScreen` untouched.
- No `useNativeDriver: false` reintroduced.
- Sampled all three screens live, and each fades and rises with the same curve:
  - **worry** — opacity 0.38 → 0.98, translateY 14.86 → 0.57
  - **action** — opacity 0.37 → 0.98, translateY 15.18 → 0.59
  - **reflection** — settles to `matrix(1, 0, 0, 1, 0, 0)` at opacity 1
  Deltas shrink across every run, i.e. `Easing.out(Easing.cubic)` is doing the work.
- **`ReflectionScreen`'s `ScrollView` is clean**: after settle `scrollTop` is 0 and the
  heading sits at 107px — no 24px gap left at the top, no clipped first line. This was the
  second risk named in *Verification*.

**Not verified here — still owed**
- **The keyboard interaction on `WorryScreen`.** This plan named it the one real risk. On
  web, `autoFocus` raises no keyboard, so it could not be exercised. On device, confirm the
  card settles with or before the keyboard and never jitters against it. If it does jitter,
  the documented fallback is to gate the entrance on `WorryScreen` only.
- **Reduced motion.** The branch is copied verbatim from `HomeScreen`'s proven path
  (`setValue(1)` then return), but `prefers-reduced-motion` could not be toggled in this
  browser, so it was not exercised.
