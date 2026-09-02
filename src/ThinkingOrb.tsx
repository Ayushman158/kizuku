import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { motion, themes } from "./tokens";
import type { PersonalityType } from "./productModel";

/**
 * A dotted orb for the moment the product is thinking.
 *
 * Built rather than installed: the thinking-orbs package renders into a DOM
 * canvas, which does not exist on iOS. This is the same idea in
 * react-native-svg, tuned to Kizuku instead of to an agent UI — the dots
 * carry the type's ink, and it runs on the two ambient motion tokens the
 * rest of the product already uses rather than inventing new timings.
 *
 * Only transforms animate, so it stays on the native driver.
 */

const RINGS = [
  { radius: 0.46, dots: 30, dot: 1.9 },
  { radius: 0.33, dots: 21, dot: 1.7 },
  { radius: 0.19, dots: 12, dot: 1.5 }
] as const;

/** Bright at the top of the sweep, faint opposite it, so the orb reads as lit rather than flat. */
function opacityAt(angle: number) {
  return 0.22 + 0.62 * (0.5 + 0.5 * Math.cos(angle - Math.PI / 2));
}

export function ThinkingOrb({
  personality,
  size = 112
}: {
  personality: PersonalityType;
  size?: number;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);

  const dots = useMemo(() => {
    const centre = size / 2;
    return RINGS.flatMap((ring, r) =>
      Array.from({ length: ring.dots }, (_, i) => {
        const angle = (i / ring.dots) * Math.PI * 2;
        return {
          key: `${r}-${i}`,
          cx: centre + Math.cos(angle) * ring.radius * size,
          cy: centre + Math.sin(angle) * ring.radius * size,
          r: ring.dot,
          opacity: opacityAt(angle)
        };
      })
    );
  }, [size]);

  useEffect(() => {
    let spinLoop: Animated.CompositeAnimation | undefined;
    let breathLoop: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion.current = enabled;
      if (enabled) return;

      spinLoop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: motion.ambientDrift,
          easing: Easing.linear,
          useNativeDriver: true
        })
      );
      breathLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1,
            duration: motion.ambientBreath,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          }),
          Animated.timing(breath, {
            toValue: 0,
            duration: motion.ambientBreath,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          })
        ])
      );
      spinLoop.start();
      breathLoop.start();
    });

    return () => {
      spinLoop?.stop();
      breathLoop?.stop();
    };
  }, [breath, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const ink = themes[personality].ink;

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Reading what you shared"
      style={{ width: size, height: size, transform: [{ rotate }, { scale }] }}
    >
      <Svg width={size} height={size}>
        <G>
          {dots.map((dot) => (
            <Circle
              key={dot.key}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={ink}
              fillOpacity={dot.opacity}
            />
          ))}
        </G>
      </Svg>
    </Animated.View>
  );
}

/** Keeps the layout box honest when the orb is swapped out. */
export function OrbSlot({ size = 112 }: { size?: number }) {
  return <View style={{ width: size, height: size }} />;
}
