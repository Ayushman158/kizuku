import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, Platform, View } from "react-native";
import * as Haptics from "expo-haptics";
import WateringCanArt from "../assets/kizuku-watering-can.svg";
import { motion } from "./tokens";
import { damp, decideRelease } from "./watering-logic";

/**
 * The watering gesture.
 *
 * Modelled on the reference clip, but built rather than played: a video
 * cannot follow a finger, cannot be interrupted halfway, and carries a
 * white box where the garden should be.
 *
 * The gesture is expressive, not productive — watering never grows the
 * plant. Growth is earned by doing the action, and the brief is explicit
 * that it should stay that way. This is affection, and it answers like it.
 */

/** Where the spout sits inside the artwork. */
const SPOUT = { x: 26, y: 98 };
const DROPS = [0, 1, 2];

export function Watering({
  reach,
  onWater,
  style
}: {
  /** Vector from the can's resting centre to the plant's centre. */
  reach: { dx: number; dy: number };
  onWater: () => void;
  style?: object;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const tip = useRef(new Animated.Value(0)).current;
  const drops = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  const reduceMotion = useRef(false);
  const pouring = useRef(false);
  const reachRef = useRef(reach);
  reachRef.current = reach;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on;
    });
  }, []);

  const settle = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      ...motion.returnSpring,
      useNativeDriver: true
    }).start();
    Animated.timing(tip, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(() => {
      pouring.current = false;
    });
  };

  const pour = () => {
    if (pouring.current) return;
    pouring.current = true;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (reduceMotion.current) {
      onWater();
      position.setValue({ x: 0, y: 0 });
      pouring.current = false;
      return;
    }

    // tip first, then let the water go — the can has to commit before it pours
    Animated.timing(tip, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    drops.forEach((drop) => drop.setValue(0));
    Animated.stagger(
      110,
      drops.map((drop) =>
        Animated.timing(drop, {
          toValue: 1,
          duration: 520,
          easing: Easing.in(Easing.quad), // water accelerates; this is the one place ease-in is right
          useNativeDriver: true
        })
      )
    ).start();

    setTimeout(onWater, 430);
    setTimeout(settle, 900);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !pouring.current,
      onMoveShouldSetPanResponder: (_, g) => !pouring.current && Math.hypot(g.dx, g.dy) > 4,
      // once we have the gesture, keep it even if the finger leaves the can
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        position.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        if (pouring.current) return;
        position.setValue({ x: damp(g.dx), y: damp(g.dy) });
      },
      onPanResponderRelease: (_, g) => {
        const verdict = decideRelease({ dx: g.dx, dy: g.dy, vx: g.vx, vy: g.vy, reach: reachRef.current });
        if (verdict === "pour") pour();
        else settle();
      },
      onPanResponderTerminate: settle
    })
  ).current;

  const dragTilt = position.x.interpolate({
    inputRange: [-160, 0, 160],
    outputRange: ["-14deg", "0deg", "10deg"],
    extrapolate: "clamp"
  });
  const pourTilt = tip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-24deg"] });

  return (
    <Animated.View
      accessibilityLabel="Water your plant"
      accessibilityHint="Drag the watering can onto the plant"
      accessibilityRole="button"
      style={[
        style,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate: dragTilt },
            { rotate: pourTilt }
          ]
        }
      ]}
      {...pan.panHandlers}
    >
      <WateringCanArt width="100%" height="100%" />

      {DROPS.map((index) => {
        const drop = drops[index]!;
        return (
          <Animated.View
            key={index}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: SPOUT.x,
              top: SPOUT.y,
              width: 5,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#EDF4EA",
              opacity: drop.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 0.9, 0.85, 0] }),
              transform: [
                { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [0, 58] }) },
                { translateX: drop.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
                { scaleY: drop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.7, 1.5, 1.1] }) }
              ]
            }}
          />
        );
      })}
    </Animated.View>
  );
}
