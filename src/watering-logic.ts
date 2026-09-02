/**
 * The watering gesture's decisions, with no React or React Native in them so
 * they can be reasoned about — and tested — without a finger.
 */

/** Finger-following is 1:1 inside this radius, then compresses. */
export const FREE_RADIUS = 96;

/** Past the free radius the can resists, the way a real thing would. */
export function damp(value: number): number {
  const distance = Math.abs(value);
  if (distance <= FREE_RADIUS) return value;
  return Math.sign(value) * (FREE_RADIUS + (distance - FREE_RADIUS) * 0.32);
}

export type Release = "pour" | "settle";

/**
 * Whether a release should pour or spring home.
 *
 * Near enough to the plant counts, and so does a committed flick aimed at it:
 * a quick flick should be enough, rather than forcing a drag past a threshold.
 *
 * Both tests measure the *damped* position — where the can actually is on
 * screen — not the raw finger delta. Past the free radius those diverge, and
 * the user is watching the can.
 */
export function decideRelease({
  dx,
  dy,
  vx,
  vy,
  reach
}: {
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  reach: { dx: number; dy: number };
}): Release {
  const shownX = damp(dx);
  const shownY = damp(dy);
  const travelled = Math.hypot(shownX, shownY);
  const distanceToPlant = Math.hypot(shownX - reach.dx, shownY - reach.dy);
  const speed = Math.hypot(vx, vy);
  const towardsPlant = shownX * reach.dx + shownY * reach.dy > 0;

  if (distanceToPlant < 130) return "pour";
  if (speed > 0.45 && towardsPlant && travelled > 24) return "pour";
  return "settle";
}
