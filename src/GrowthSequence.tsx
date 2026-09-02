import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Asset } from "expo-asset";

/**
 * The optimiser's seed opening, played from the rendered clip.
 *
 * The source is a 5s 2880px video on a white ground. Video is no use here —
 * mp4 carries no alpha, so it would paint a white box over the garden — so
 * it is keyed to a 26-frame sequence with real transparency. The matte keys
 * on the minimum channel rather than luminance, which protects the golden
 * highlights, and un-blends the anti-aliased edges from white so there is no
 * fringe. One bounding box across every frame keeps the plant registered.
 *
 * The clip ends on a sapling, while the garden's grown state is the mature
 * tree — a later stage of the same plant. So the sequence hands off: it
 * plays, holds, then crossfades to the tree, which reads as it carrying on
 * growing rather than as two pictures swapping.
 */

const FRAMES = [
  require("../assets/growth/optimiser-00.png"),
  require("../assets/growth/optimiser-01.png"),
  require("../assets/growth/optimiser-02.png"),
  require("../assets/growth/optimiser-03.png"),
  require("../assets/growth/optimiser-04.png"),
  require("../assets/growth/optimiser-05.png"),
  require("../assets/growth/optimiser-06.png"),
  require("../assets/growth/optimiser-07.png"),
  require("../assets/growth/optimiser-08.png"),
  require("../assets/growth/optimiser-09.png"),
  require("../assets/growth/optimiser-10.png"),
  require("../assets/growth/optimiser-11.png"),
  require("../assets/growth/optimiser-12.png"),
  require("../assets/growth/optimiser-13.png"),
  require("../assets/growth/optimiser-14.png"),
  require("../assets/growth/optimiser-15.png"),
  require("../assets/growth/optimiser-16.png"),
  require("../assets/growth/optimiser-17.png"),
  require("../assets/growth/optimiser-18.png"),
  require("../assets/growth/optimiser-19.png"),
  require("../assets/growth/optimiser-20.png"),
  require("../assets/growth/optimiser-21.png"),
  require("../assets/growth/optimiser-22.png"),
  require("../assets/growth/optimiser-23.png"),
  require("../assets/growth/optimiser-24.png"),
  require("../assets/growth/optimiser-25.png")
];

/**
 * Pull the frames into cache before they are needed. Without this the first
 * play stutters while 26 files decode — the reflection screen is the last
 * quiet moment before the growth, so it warms them there.
 */
export function preloadGrowthFrames() {
  Asset.loadAsync(FRAMES).catch(() => {});
}

/** 26 frames at 50ms — the clip's five seconds, played in one and a third. */
const FRAME_MS = 50;
const HOLD_MS = 220;

export function GrowthSequence({
  grownSource,
  reduceMotion,
  width = 250,
  height = 343
}: {
  grownSource: number;
  reduceMotion: boolean;
  width?: number;
  height?: number;
}) {
  const [frame, setFrame] = useState(0);
  const handoff = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      setFrame(FRAMES.length - 1);
      handoff.setValue(1);
      return;
    }

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index >= FRAMES.length) {
        clearInterval(timer);
        setFrame(FRAMES.length - 1);
        setTimeout(() => {
          Animated.timing(handoff, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }).start();
        }, HOLD_MS);
        return;
      }
      setFrame(index);
    }, FRAME_MS);

    return () => clearInterval(timer);
  }, [handoff, reduceMotion]);

  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "flex-end" }}>
      <Animated.Image
        source={FRAMES[frame]}
        resizeMode="contain"
        style={{
          position: "absolute",
          bottom: 0,
          width,
          height,
          opacity: handoff.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
        }}
      />
      <Animated.Image
        source={grownSource}
        resizeMode="contain"
        style={{
          position: "absolute",
          bottom: 0,
          width,
          height,
          opacity: handoff,
          transform: [{ scale: handoff.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          transformOrigin: "center bottom"
        }}
      />
    </View>
  );
}
