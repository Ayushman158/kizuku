import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

/**
 * Light breaking behind something that has just arrived — the tree at the
 * reveal, the new stage at growth.
 *
 * Finch hatches its bird in front of a burst of rays, and it is the brightest
 * frame in its onboarding. This is the same gesture in Kizuku's material:
 * the rays are the paper colour at partial strength, so on amber, sky or sage
 * they read as light on that surface rather than as a new colour laid over it.
 * A soft glow sits at the centre, where the plant stands.
 *
 * They turn once a minute. Anything faster starts to read as a loading
 * spinner, which is the wrong message for a moment that is meant to settle.
 * With reduce motion on they are still, and nothing else changes.
 */

const RAYS = 16;
const PAPER = "#FFFDF8";

function wedge(index: number): string {
  const step = (Math.PI * 2) / RAYS;
  const half = step * 0.28;
  const angle = index * step;
  const r = 100;
  const x1 = Math.cos(angle - half) * r;
  const y1 = Math.sin(angle - half) * r;
  const x2 = Math.cos(angle + half) * r;
  const y2 = Math.sin(angle + half) * r;
  return `M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

const WEDGES = Array.from({ length: RAYS }, (_, index) => wedge(index));

export function Rays({
  size,
  reduceMotion,
  strength = 0.34
}: {
  size: number;
  reduceMotion: boolean;
  /** opacity of the rays; the glow scales with it */
  strength?: number;
}) {
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      turn.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox="-100 -100 200 200">
          <Defs>
            {/* the rays fade out toward the edge, so the burst has no hard rim */}
            <RadialGradient id="fade" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
              <Stop offset="0.12" stopColor={PAPER} stopOpacity={strength} />
              <Stop offset="1" stopColor={PAPER} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {WEDGES.map((d, index) => (
            <Path key={index} d={d} fill="url(#fade)" />
          ))}
        </Svg>
      </Animated.View>

      {/* the glow does not turn, so it reads as a light source, not a pattern */}
      <View style={{ position: "absolute", left: 0, top: 0, width: size, height: size }}>
        <Svg width={size} height={size} viewBox="-100 -100 200 200">
          <Defs>
            <RadialGradient id="glow" cx="0" cy="0" r="46" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={PAPER} stopOpacity={Math.min(0.85, strength * 2.2)} />
              <Stop offset="1" stopColor={PAPER} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={0} cy={0} r={46} fill="url(#glow)" />
        </Svg>
      </View>
    </View>
  );
}
