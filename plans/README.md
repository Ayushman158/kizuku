# Animation plans

Implementation plans. 001–004 came out of an `improve-animations` audit; later ones cover
other work in the same format. Each is self-contained: an executor with no context from the
originating conversation should be able to run it end to end.

| # | Title | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| [001](001-tear-physics.md) | Replace hold-to-commit with a swipe that parts the perforation | MEDIUM | Physicality & origin | TODO |
| [002](002-native-driver-committing.md) | Take the committing progress bar off the JS thread | HIGH | Performance + Cohesion | **DONE** |
| [003](003-ritual-screen-entrances.md) | Stop the daily ritual cutting between animated and static screens | MEDIUM | Cohesion & tokens | **DONE** |
| [004](004-reveal-ceremony.md) | Give the type reveal the one moment it only gets once | MEDIUM | Purpose & frequency | **DONE** |
| [005](005-persistence.md) | Make the app remember you | HIGH | Product | TODO |

## Recommended execution order

**005 next.** 002, 003 and 004 are done. 001 is parked (see below), so persistence is the
open work with the most leverage: it is the difference between a demo that resets and an app
that remembers you, and it is what "In development" on the portfolio is really pointing at.

- **002 first.** It is the only HIGH, it is the smallest change in the set, and the fix is
  already written in this repo at `src/HoldButton.tsx:113-115` — a pattern applied once and
  missed the second time. Landing it also clears the repo's only `useNativeDriver: false`,
  which 004 then asserts on.
- **003 next.** One edit to `GradientScreen` fixes three screens. It is the change a user
  feels every single day.
- **004 after.** Rare-moment polish; nothing depends on it.
- **001 is PARKED, deliberately.** It specifies a tear along a seed packet's perforation,
  but the app's commit control is a green pill with a progress line — there is no packet to
  tear. Adopting it would mean restyling `actionCard` as a packet and moving the commit into
  its seam, which is a design change well beyond what 001 scoped. The interaction lives in
  the design canvas and stays there until that call is made. Do not port it as written; a
  tear on a pill button is incoherent.

001 has an internal order that matters: **read the canvas prototype first, then port to the
app.** The canvas file lives in a session scratchpad and may be gone; the plan says what to
do in that case.

## Dependencies

- **004 depends on 002** only in its verification: it greps for zero `useNativeDriver: false`
  in `src/KizukuApp.tsx`, which 002 is what makes true. Run 002 first, or relax that check.
- 001, 002 and 003 are independent of each other.
- 001 and 003 both touch `src/KizukuApp.tsx` but in different functions (the commit control
  vs `GradientScreen`), so they will not conflict.

## Notes

- **001 deliberately does not overturn the documented `Easing.linear`** at
  `src/HoldButton.tsx:67`. That comment is correct for a filling bar; the plan applies only
  where the same control is drawn as a torn seam, and says so in its Boundaries.
- **Reduced motion is already handled well across this app** — every animated component
  gates on it, including the ambient loops. Every plan here preserves that; none of them
  should be the reason it regresses.
- Physics, haptics and gesture feel cannot be judged from code or a desktop browser. Plans
  touching any of those carry an on-device feel check, and it is not optional.
- The audit also found these already correct, and no plan should "fix" them:
  `HoldButton`'s interruption handling (`stopAnimation` → `settleBack`),
  `GrowthSequence`'s `transformOrigin: "center bottom"`, and `Watering`'s physics model.

## Outstanding across the finished plans

Three checks could not be run in a desktop browser and are owed on a real device. Clear them
in one pass:

1. **Reduced motion** — 002, 003 and 004 all branch on it and all three branches are
   unexercised. `prefers-reduced-motion` cannot be toggled in the preview browser.
2. **The keyboard on `WorryScreen`** (003) — `autoFocus` raises no keyboard on web, so the
   entrance never had anything to fight.
3. **Smoothness at the committing → growth handoff** (002) — the reason 002 was HIGH. The JS
   thread is not contended on desktop the way it is on a phone.
