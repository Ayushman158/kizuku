import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * A ring of sparkles thrown outward once, the instant something grows.
 *
 * Finch's hatch is anticipation, then a burst, then the bird: the burst is
 * what turns the reveal into an event. These are the four-point sparkle the
 * action tag already uses, drawn as stickers — a paper fill inside a dark
 * outline — so they read on amber, sky and sage alike, the same way the tab
 * bar's icons do.
 *
 * One value drives the whole ring, on the native driver. Each sparkle takes
 * its own angle, distance, size and spin from its index, so the burst looks
 * scattered but is identical every time. Under reduce motion nothing is
 * drawn: the light behind the plant still marks the moment.
 */

const STAR = "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z";

// stable pseudo-random from an index, so the ring never reshuffles on render
function scatter(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function Burst({
  play,
  reduceMotion,
  count = 12,
  radius = 150,
  ink,
  fills
}: {
  /** flips true at the moment of growth; the burst plays once */
  play: boolean;
  reduceMotion: boolean;
  count?: number;
  radius?: number;
  /** outline colour */
  ink: string;
  /** fills to cycle through */
  fills: readonly string[];
}) {
  const progress = useRef(new Animated.Value(0)).current;

  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2 + (scatter(index, 1) - 0.5) * 0.5;
        const distance = radius * (0.72 + scatter(index, 2) * 0.45);
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - radius * 0.12, // a little lift, like it was thrown
          size: 14 + Math.round(scatter(index, 3) * 12),
          spin: (scatter(index, 4) > 0.5 ? 1 : -1) * (60 + scatter(index, 5) * 90),
          fill: fills[index % fills.length]!
        };
      }),
    [count, radius, fills]
  );

  useEffect(() => {
    if (!play || reduceMotion) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [play, progress, reduceMotion]);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      {sparks.map((spark, index) => (
        <Animated.View
          key={index}
          style={{
            position: "absolute",
            left: -spark.size / 2,
            top: -spark.size / 2,
            opacity: progress.interpolate({ inputRange: [0, 0.08, 0.6, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, spark.x] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, spark.y] }) },
              { scale: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1.1, 0.6] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${spark.spin}deg`] }) }
            ]
          }}
        >
          <Svg width={spark.size} height={spark.size} viewBox="0 0 24 24">
            <Path d={STAR} fill={spark.fill} stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}
