# 002 — Take the committing progress bar off the JS thread

- **Status**: DONE — implemented and verified on 2026-09-04 (web). On-device check still outstanding, see below.
- **Commit**: 34c481c
- **Severity**: HIGH
- **Category**: Performance (AUDIT §5), with Cohesion (§7)
- **Estimated scope**: 1 file, ~15 lines

## Problem

`CommittingScreen` animates a progress bar for **1900ms on the JavaScript thread**. It is
the screen that plays immediately after the user's single daily commitment — the most
ceremonial moment in the product — and it is the one animation in the app that cannot
survive a busy frame.

`src/KizukuApp.tsx:601-608` — current:

```tsx
  useEffect(() => {
    const duration = reduceMotion ? 350 : 1900;
    const progressAnimation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false
    });
```

`src/KizukuApp.tsx:623` — why it cannot be native-driven as written:

```tsx
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
```

`src/KizukuApp.tsx:631-633` — the consumer:

```tsx
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
```

`width` is a layout property. React Native's native driver only handles `transform` and
`opacity`, so any `width` animation is forced onto the JS thread and will stutter whenever
JS is busy — exactly what happens here, since `onDone()` fires at the end and the next
screen (`GrowthScreen`) is preloading 26 image frames via `preloadGrowthFrames()`.

**This repo has already solved this exact problem.** `src/HoldButton.tsx:113-115` carries
the fix and the reasoning in a comment:

```tsx
  // the fill slides in from the left edge; translate stays on the native driver
  const fillTransform = width
    ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }]
    : [{ translateX: -9999 }];
```

The pattern was written once and not applied the second time.

## Target

A full-width fill that starts translated fully to the left and slides to zero, inside the
existing `overflow: "hidden"` track. Identical appearance, native driver throughout.

```tsx
// state, alongside the existing refs
const [trackWidth, setTrackWidth] = useState(0);

// the animation — the ONLY change is the driver
const progressAnimation = Animated.timing(progress, {
  toValue: 1,
  duration,
  easing: Easing.inOut(Easing.cubic),
  useNativeDriver: true
});

// replace progressWidth
const fillTransform = trackWidth
  ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-trackWidth, 0] }) }]
  : [{ translateX: -9999 }];
```

```tsx
// render
<View style={styles.progressTrack} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
  <Animated.View
    style={[styles.progressFill, { width: "100%", transform: fillTransform }]}
  />
</View>
```

`styles.progressTrack` (`KizukuApp.tsx:1435-1443`) already has `overflow: "hidden"` and
`borderRadius: 2`, so the off-screen half is clipped exactly as it is in `HoldButton`.
`styles.progressFill` (`KizukuApp.tsx:1445`) keeps `height: 3` and
`backgroundColor: color.forest[500]`; only `width: "100%"` is added at the call site.

**Reduced motion is unchanged.** The existing branch at `KizukuApp.tsx:602` shortens the
duration to 350ms and that behaviour must survive exactly. `HoldButton.tsx:129-130`
additionally swaps to an opacity fade under reduced motion; do **not** copy that here — the
350ms duration is this screen's documented accommodation and a 3px bar sliding for 350ms is
not a vestibular problem.

## Repo conventions to follow

- **Exemplar to imitate: `src/HoldButton.tsx:106-133`.** Same problem, same fix, already in
  this codebase — measure the track with `onLayout`, translate a full-width fill, keep the
  native driver. Match its structure and its habit of explaining the constraint in a comment.
- Colours come from `color` in `src/tokens.ts`; `styles.progressFill` already uses
  `color.forest[500]`. Do not introduce a literal hex.
- Durations that are shared live in `motion` in `src/tokens.ts`. The 1900ms here is
  screen-specific and stays inline — do not move it.

## Steps

1. In `src/KizukuApp.tsx`, add `const [trackWidth, setTrackWidth] = useState(0);` inside
   `CommittingScreen` (function starts at line 596), beside the existing `progress` and
   `figurePulse` refs. `useState` is already imported.
2. Change `useNativeDriver: false` to `useNativeDriver: true` at `KizukuApp.tsx:607`.
3. Delete the `progressWidth` interpolation at `KizukuApp.tsx:623` and replace it with the
   `fillTransform` block from *Target*.
4. Add `onLayout` to the `progressTrack` `View` and change the fill to
   `{ width: "100%", transform: fillTransform }` per *Target*.
5. Add a one-line comment above `fillTransform` matching the house habit, e.g.
   `// width cannot be native-driven; translate a full-width fill instead (see HoldButton)`.

## Boundaries

- Do NOT touch `figurePulse` — it is already `useNativeDriver: true` and correct.
- Do NOT change the 1900ms or 350ms durations, or the `Easing.inOut(Easing.cubic)` curve.
  The pacing of this screen is deliberate; only the driver is wrong.
- Do NOT change `styles.progressTrack` or `styles.progressFill` in the stylesheet. The
  `width: "100%"` is added at the call site so the style stays reusable.
- Do NOT touch `src/HoldButton.tsx` — it is the reference, not the target.
- Do NOT add dependencies.
- If a step does not match the code you find (drift since commit `34c481c`), STOP and report.

## Verification

**Mechanical**
- `cd ~/Kizuku-app && npx tsc --noEmit` — expect no new errors.
- `grep -n "useNativeDriver: false" src/KizukuApp.tsx` — expect **no matches**. That single
  command is the headline result of this plan.

**Feel check**
- Run the app, complete an action, and watch the committing screen: the bar must fill left
  to right over ~1.9s, reaching the full track width exactly as it does today. Any visible
  change in appearance means the translate distance or `width: "100%"` is wrong.
- The bar must **start empty**, not flash full for one frame. If it flashes, `trackWidth` is
  still 0 on first paint — confirm the `translateX: -9999` fallback is present.
- Confirm the fill stays inside the rounded track and does not bleed past either end
  (`overflow: "hidden"` on `progressTrack` is doing this).
- Enable reduced motion and repeat: the bar completes in ~350ms and the meditating figure
  does not pulse.
- **On device**, watch the very end of the bar as it hands over to `GrowthScreen` — this is
  where 26 image frames preload and where the old JS-driven bar was most likely to hitch.
  It should now stay smooth through the transition.

**Done when**
- `useNativeDriver: false` appears nowhere in `src/`.
- The bar looks identical to before and completes in the same time.
- No stutter at the handoff to the growth screen on a real device.

---

## Execution record (2026-09-04)

Implemented directly against commit `34c481c`; diff is 13 insertions / 4 deletions in
`src/KizukuApp.tsx` only.

**Passed**
- `npx tsc --noEmit` → exit 0.
- `grep -rn "useNativeDriver: false" src/` → no matches. The repo now has none.
- Sampled the live fill on web during the animation:
  - track measured at 296px via `onLayout`;
  - fill width constant at 296px across every frame — width is no longer animated;
  - `translateX` ran −295.4 → −19.2;
  - frame deltas 3.4 / 10.3 / 17.3 / 32.5 / 42.6 / 57.0 / 55.0 / 33.7 / 24.4 — slow, fast,
    slow, i.e. `Easing.inOut(Easing.cubic)` is intact;
  - first sampled frame was already −295.4, so there is no flash of a full bar.
- No console errors; `onDone()` still fires and advances to the reflection screen.

**Not verified here — still owed**
- The on-device check in *Verification*: smoothness at the handoff to `GrowthScreen` while
  it preloads 26 frames. That was the reason this plan was HIGH, and a desktop browser
  cannot show it.
- The reduced-motion path (350ms). The `duration` ternary and the branch are untouched and
  the shortened run uses the same translate, so the risk is low — but it was not exercised.
