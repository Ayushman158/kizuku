# 001 — Replace hold-to-commit with a swipe that parts the perforation

- **Status**: TODO — *prototyped in the design canvas; not yet ported to the app*
- **Supersedes**: the hold-driven version of this plan (the gesture changed from hold to swipe on 2026-09-04)
- **Commit**: 34c481c
- **Severity**: MEDIUM
- **Category**: Physicality & origin (AUDIT §3), with §2 easing and §6 accessibility consequences
- **Estimated scope**: 2 files — one canvas artboard (prototype), one React Native component (ship). ~120 lines net.

## Problem

The commit control is a **linear progress fill wearing a tear's clothes**. Paper does not
separate at a constant rate, and once the control is drawn as a seed packet's glued seam
labelled `HOLD TO TEAR OPEN`, a constant-rate fill is the one thing on screen that reads
as software rather than as an object.

Three specific unphysical behaviours:

**1. Constant rate.** Real tearing is *stick–slip*: fibres fail in clusters, so the tear
front jumps forward in bursts and stalls between them. It never advances smoothly.

**2. No initiation resistance.** Starting a tear from an edge takes the most force;
once a crack front exists, stress concentrates at its tip and propagation gets easier.
Real tears start hard and then run away. This one advances at exactly the same rate at
0% as at 90%.

**3. It un-tears on release.** Paper does not reassemble. Releasing early currently
animates the tear back to zero, which is both physically impossible and unkind — a
finger slip at 90% costs the user the whole hold.

**4. The gesture itself is wrong.** Nobody opens a packet by holding it still. A hold is
a timer with a metaphor painted on it; tearing is a *pull*. The gesture should be a
swipe along the seam, so the finger drives the tear rather than waiting for it.

**5. A sweeping fill is not a tear.** The first swipe build slid a coloured band across the
seam — still a progress bar, just gesture-driven. What has to happen is that the
**perforation comes apart**: the flap separates from the packet body along the dotted line,
right to left, the two halves pivoting away from a moving tear front with a ragged wedge
opening between them. The label tears in half with it.

Current code, canvas prototype — `scratchpad/kz/Main.dc.html:191` (see *Boundaries* for
this file's status):

```js
  step() {
    if (this.state.done) return;
    const next = Math.min(this.state.tear + 4, 100);   // +4% every 40ms, forever
    if (next >= 100) {
      clearInterval(this.timer);
      this.setState({ tear: 100, done: true });
      return;
    }
    this.setState({ tear: next });
  }
```

`Main.dc.html:150` — the tear front is a straight vertical edge:

```html
<div style="position:absolute; inset:0; width:{{tearPct}}; background:{{t.band}}; transition:width 90ms linear;"></div>
```

Ship target — `src/HoldButton.tsx:66`:

```tsx
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear, // a filling bar should fill at a constant rate
      useNativeDriver: true
    })
```

### Why this is not re-litigating a settled decision

`HoldButton.tsx:67` documents `linear` deliberately, and `HoldButton.tsx:15` says
*"Press is deliberate (1s, linear — the user is deciding)."* That reasoning is sound
**for a filling bar**, which is what the control was when it was written.

The premise changed, not the judgement: the seed-packet artboard reframes the same
control as a **tear**, and "a filling bar should fill at a constant rate" does not
transfer to a tear. Where the control is still a bar it stays linear — see *Boundaries*.

## Target

A **finger-driven** stick-slip model. The finger does not drag the tear directly: it opens
a *gap* against the seam's resistance, and when the gap wins, the crack **slips** forward —
often past the finger — and the tension drops to nothing until the hand catches up. Nothing
reverses.

**Constants** (module scope, named exactly). These are tuned, not guessed — see
*Verification* for the simulation that chose them:

```js
const R_START = 0.16;    // gap needed to start the tear, as a fraction of the seam
const R_RUN   = 0.05;    // gap needed once it is running — a started tear is easier
const CATCH   = 0.85;    // how much of the gap a slip closes
const RUNAWAY = 1.2;     // a running crack jumps further per release
const JIT     = 0.02;    // slip-size randomness
const COMMIT  = 0.55;    // release past this and it rips the rest of the way
const FLICK   = 0.55;    // px/ms — a fast pull rips regardless of distance
```

**Per pointermove:**

```js
const finger = clamp((e.clientX - startX) / seamWidth, 0, 1);
const gap    = finger - tear;                 // negative while the tear runs ahead
const resist = R_RUN + (R_START - R_RUN) * Math.pow(1 - tear, 1.6);

if (gap > resist) {
  const jump = gap * CATCH * (1 + RUNAWAY * tear) + (Math.random() * 2 - 1) * JIT;
  tear = Math.min(1, tear + Math.max(jump, 0.01));
  onSlip();                                   // ragged edge redraw + one light haptic
} else {
  strain = Math.max(0, gap) / resist;         // the seam stretches before it gives
}
```

On a 270px seam this produces **8 discrete catches**, the first after **48px** of pull
(real initiation resistance), with the spacing tightening from ~36px to ~24px so it
accelerates as it runs. Slipping past the finger is correct and wanted — that is what a
crack does when it catches.

**Release** (`onPointerUp`): compute velocity from the last two move samples.
- `tear >= COMMIT`, **or** `velocity > FLICK` and `tear > 0.12` → `rip()`: finish the
  remaining seam in self-driven slips of `0.07 + random()*0.05` every 26ms. Momentum.
- Otherwise the tear **stays exactly where it is**. It does not rewind. A second pull
  resumes from there (`startX = clientX - tear * seamWidth`).

**The tear edge must be ragged**, redrawn on every slip:

```js
function tearEdge(t) {
  const pct = (t * 100).toFixed(2);
  const pts = ['0% 0%', pct + '% 0%'];
  for (let i = 1; i <= 9; i++) {
    const jag = (Math.random() * 6 - 3).toFixed(1);
    pts.push('calc(' + pct + '% + ' + jag + 'px) ' + Math.round(i / 9 * 100) + '%');
  }
  pts.push('0% 100%');
  return 'polygon(' + pts.join(', ') + ')';
}
```

**Affordances the swipe needs that the hold did not:**
- A **starter notch** at the left edge of the seam — a real packet tells you where to begin.
- A **grip chevron** riding the tear front, nudged `strain * 5px` so the tension is visible
  before the seam gives.
- Label states: `pull to tear open` → `keep pulling` (dragging) → `keep going` (partial,
  released) → `opened · committed`.
- `touch-action: pan-y` on the seam so it claims the horizontal axis without blocking
  vertical scroll.

**Accessibility — this is the swipe's real cost.** A drag is harder than a hold for motor
impairment, and it is not discoverable by a screen reader.
- Keep `onAccessibilityTap={onComplete}` (already at `HoldButton.tsx:97`) so assistive
  tech commits with a single activation. **Do not remove it.**
- `accessibilityHint` must change from "Press and hold to commit" to "Swipe right to tear
  open, or double tap to commit".
- **Reduced motion**: no jitter, no per-slip haptic, no runaway; the swipe still drives the
  tear but the edge stays straight and `rip()` completes in one 200ms fill.

## Repo conventions to follow

- **Motion constants live in `src/tokens.ts`** under `export const motion`, e.g.
  `reactTap: 260`, `growSpring: { damping: 15, stiffness: 58 }`. Add the tear constants
  there as `motion.tear = { rStart: 0.16, rRun: 0.05, catch: 0.85, runaway: 1.2, jitter: 0.02, commit: 0.55, flick: 0.55 }` rather than as loose numbers in the component.
- **Colours come from `color` / `themes` in `src/tokens.ts`** — never literal hex in a
  component.
- **Exemplar to imitate: `src/Watering.tsx`.** It already runs a hand-written physics
  model (`damp()` free-radius compression, velocity-based release) with its constants
  named and commented, and it is the house pattern for "simulate the object, do not
  animate a value". Follow its structure: pure functions for the model, `Animated.Value`
  for the output.
- **Haptics**: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` guarded by
  `Platform.OS !== "web"` and `.catch(() => {})` — exactly as `HoldButton.tsx:61` does.
- **Reduced motion**: read once via `AccessibilityInfo.isReduceMotionEnabled()` into a
  ref, as `HoldButton.tsx:34-38` does.

## Steps

1. **The canvas prototype is already built and tuned** — `Main.dc.html` implements
   everything in *Target*. Read it first and port from it rather than re-deriving; steps
   2–6 are done there. If the scratchpad is gone, implement *Target* directly.
2. In the same file, replace the `width: {{tearPct}}` fill at `Main.dc.html:150` with a
   `clip-path: {{tearClip}}` produced by `tearEdge()`, regenerated in `onSlip()`.
3. In the same file, add the flap separation: below the tear line, apply
   `transform: translateY({{flapY}}px) rotate({{flapDeg}}deg)` where
   `flapY = tear * 3` and `flapDeg = tear * 0.8`, with `transform-origin: left center`.
4. Add `navigator.vibrate(6)` inside `onSlip()`, guarded by `if (navigator.vibrate)`.
5. Add the reduced-motion branch: `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
   → skip the model, run a single 1000ms linear fill with a straight edge.
6. **Feel-check the prototype** (see *Verification*) and only then port.
7. Add `tear` to `motion` in `src/tokens.ts` with the constants from *Target*.
8. Port into `src/HoldButton.tsx`, renaming it `TearStrip.tsx` (the control is no longer a
   hold). Replace `Pressable` + `Animated.timing` at `HoldButton.tsx:64-77` with a
   `PanResponder` (as `src/Watering.tsx` already uses) driving the model. Keep `press`, the
   label swap, `onComplete`, and every accessibility prop — especially
   `onAccessibilityTap`.
9. Delete `settleBack()` and the `RELEASE_MS` rewind entirely — the tear holds. Keep the
   `press` scale release at 160ms. Update `accessibilityHint` per *Target*.
10. Fire `Haptics.impactAsync(Light)` once per slip, not once per press.

## Boundaries

- **`scratchpad/kz/Main.dc.html` is ephemeral.** It is the design-canvas working file and
  its directory is a session scratchpad. If it is gone, skip steps 1–6, port straight into
  the app, and feel-check on the simulator instead. Do not recreate the canvas.
- **Do NOT change `HOLD_MS` (1000ms) or `RELEASE_MS` (200ms).** The tear must still
  complete in about a second.
- **Do NOT apply this to any other control.** `HoldButton` is used for exactly one button
  ("i'll do it now") — `HoldButton.tsx:11-13` says so. Every other button stays a plain tap.
- **Do NOT make the linear fill a finding anywhere the control is still a bar.** If a
  surface renders this as a pill with a progress line rather than a torn seam, `linear`
  remains correct there and `HoldButton.tsx:67`'s comment stands.
- Do NOT change markup, copy, colours, layout or the icon — motion only.
- Do NOT add dependencies. No physics library; the model is 20 lines.
- Do NOT use `setInterval` for the loop — it drifts and cannot supply `dt`.
- If a step does not match the code you find (drift since commit `34c481c`), STOP and
  report rather than improvising.

## Verification

**Mechanical**
- `cd ~/Kizuku-app && npx tsc --noEmit` — expect no new errors.
- **Re-run the tuning simulation before changing any constant.** The values in *Target*
  were chosen by simulating a finger crossing a 270px seam and counting slips. A good set
  gives **7–9 slips**, a **first slip at 45–55px**, and spacing that *tightens* toward the
  end. The set that was rejected (`R_START 0.095 / R_RUN 0.024 / CATCH 0.90`, no runaway)
  produced 17 slips at a flat 12px spacing — that is continuous tracking with noise, not
  stick-slip, and it looks like a progress bar. If you retune, prove the new numbers the
  same way rather than eyeballing them.

**Feel check** — the point of the plan; do not skip.
- Pull slowly: the seam must **catch and release in visible steps**, not track the finger.
  If the tear front shadows your finger continuously, `CATCH` is too high or the resistance
  too low — see the rejected set above.
- The **first ~48px must resist.** The seam should visibly stretch (the grip chevron leans)
  before anything gives. If it tears immediately, `R_START` is too low.
- Slips must sometimes **overshoot the finger** — the crack running ahead of your hand is
  correct, not a bug. Do not clamp `tear` to `finger`.
- The tear front must be **ragged and different every attempt**. Tear twice and compare; an
  identical edge means `tearEdge()` is not regenerating per slip.
- Release at ~30% (slowly, no velocity): the seam **stays torn at 30%** and does not commit.
  Pull again — it must resume from 30%, not restart.
- Release at ~60%: it **rips the rest of the way on its own** and commits.
- **Flick** fast from ~15% and let go: momentum must finish it even though you never crossed
  `COMMIT`. If nothing happens, the velocity samples in `hist` are stale or too few.
- Vertical scroll must still work when the drag starts on the seam (`touch-action: pan-y`).
- Toggle `prefers-reduced-motion`: straight edge, no jitter, no haptic, still completes.
- **On device** (physics and haptics cannot be judged on a desktop browser): each slip fires
  one light impact, so the tear is *felt* as a series of catches. One haptic at the start
  means the per-slip call was missed.
- **VoiceOver**: focus the control and double-tap — it must commit immediately via
  `onAccessibilityTap` without any swipe.

**Done when**
- 7–9 discrete catches across the seam; first at ~48px; spacing tightens as it runs.
- The edge is jagged and differs between attempts.
- Releasing early preserves progress; a second pull resumes it; past `COMMIT` or on a flick
  it rips home by itself.
- Reduced motion still completes; VoiceOver still commits on double-tap.
- `TearStrip` is the only control affected.
