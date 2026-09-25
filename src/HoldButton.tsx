import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { color, radius, target, text } from "./tokens";
import { Icon, type IconName } from "./Icon";

/** depth of the stamped edge, matching PrimaryButton */
const EDGE = 4;

/**
 * Hold to commit.
 *
 * Used for exactly one control: "i'll do it now". It is the most important
 * tap in the product and it happens once a day, so it can afford weight —
 * the commitment becomes physical rather than incidental. Every other button
 * stays a plain tap; ceremony everywhere is ceremony nowhere.
 *
 * Press is deliberate (1s, linear — the user is deciding). Release is snappy
 * (200ms, ease-out — the system is responding). That asymmetry is the point.
 */

const HOLD_MS = 1000;
const RELEASE_MS = 200;

export function HoldButton({
  label,
  onComplete,
  disabled
}: {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [held, setHeld] = useState(false);
  const reduceMotion = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on;
    });
  }, []);

  const settleBack = (duration: number) => {
    Animated.timing(progress, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  };

  const start = () => {
    if (disabled) return;
    finished.current = false;
    setHeld(true);

    Animated.timing(press, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear, // a filling bar should fill at a constant rate
      useNativeDriver: true
    }).start(({ finished: done }) => {
      if (!done) return;
      finished.current = true;
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onComplete();
    });
  };

  const cancel = () => {
    setHeld(false);
    Animated.timing(press, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (finished.current) return;
    progress.stopAnimation(() => settleBack(RELEASE_MS));
  };

  // the fill slides in from the left edge; translate stays on the native driver
  const fillTransform = width
    ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }]
    : [{ translateX: -9999 }];

  return (
    <Pressable
      accessibilityHint="Press and hold to commit"
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onAccessibilityTap={onComplete}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPressIn={start}
      onPressOut={cancel}
      style={{ width: "100%" }}
    >
      {/*
        The edge is a layer, not a shadow. The face clips its progress line
        with overflow: hidden, and on iOS that clips shadows too — so the
        stamped edge every other button now carries would never render here.
        A darker pill sits underneath instead, and holding presses the face
        down into it: the same physical press as the other buttons, and a
        truer one for a control you keep your thumb on.
      */}
      <View
        style={{
          borderRadius: radius.pill,
          backgroundColor: disabled ? "transparent" : color.forest[700],
          paddingBottom: EDGE
        }}
      >
      <Animated.View
        style={{
          height: target.control,
          borderRadius: radius.pill,
          backgroundColor: disabled ? "rgba(44,82,40,0.28)" : color.forest[500],
          overflow: "hidden",
          justifyContent: "center",
          transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, EDGE - 1] }) }]
        }}
      >
        {/*
          A line along the bottom rather than a wash behind the label. Two
          greens from the ramp only reach 1.85:1 against each other — too weak
          to read as progress — and a light enough wash would drop the white
          label to 3:1. On the edge, forest/100 is unmistakable and the label
          stays at 8.96:1 the whole way across.
        */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: color.forest[100],
            opacity: reduceMotion.current ? progress : 1,
            transform: reduceMotion.current ? [] : fillTransform
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Text style={{ ...text.label, fontSize: 15, lineHeight: 20, color: "#FFFFFF" }}>
            {held ? "keep holding…" : label}
          </Text>
          <Icon name={held ? "circle" : "arrow-forward"} size={17} color="#FFFFFF" />
        </View>
      </Animated.View>
      </View>
    </Pressable>
  );
}
