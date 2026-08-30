import { Platform, TextStyle, ViewStyle } from "react-native";

/**
 * Kizuku design tokens.
 *
 * Reconciles the three sources that had drifted apart: the Figma wireframe,
 * the web prototype's CSS variables, and this build's inline palette.
 * Nothing here is a local decision — a new value is a system change.
 */

export const color = {
  paper: {
    card: "#FFFDF8",
    50: "#FBF8EE",
    100: "#F4EFDF",
    200: "#ECE3CB",
    300: "#D9CDB0"
  },
  stone: {
    300: "#B8AE9A",
    /** icons and graphics only — 3.09:1 on card, never text */
    400: "#9A9080",
    500: "#7B7160",
    700: "#4D4636",
    900: "#221E16"
  },
  forest: {
    50: "#E9F0DD",
    100: "#CCDDB4",
    300: "#6F9F66",
    500: "#2C5228",
    600: "#1C3C1C",
    700: "#0E2310"
  },
  garden: {
    card: "#EDF4EA",
    surface: "#B8D4AC",
    mid: "#8AB07C",
    deep: "#577950"
  },
  /** destructive only */
  clay: "#C6785E",
  onDark: "#F2F5E9",
  onDarkMuted: "rgba(242,245,233,0.72)",
  line: "rgba(94,85,72,0.15)",
  hairline: "rgba(28,60,28,0.07)"
} as const;

/**
 * The type themes the quiz assigns. Each is a surface, a raised layer, an
 * edge and an ink — nothing else changes between them.
 */
export const themes = {
  optimizer: { surface: "#ECD858", raised: "#E1CC48", edge: "#D4BE30", ink: "#4A3800" },
  seeker: { surface: "#A4C8DE", raised: "#90B6D1", edge: "#7AAAC8", ink: "#0E2C48" },
  /** ink borrowed from forest/600: the wireframe's #2C5828 measured 4.32:1 */
  planner: { surface: "#A4C49C", raised: "#8DB186", edge: "#78A06C", ink: color.forest[600] }
} as const;

export type ThemeName = keyof typeof themes;

export const font = {
  serifLight: "Newsreader_300Light",
  serif: "Newsreader_400Regular",
  serifItalic: "Newsreader_300Light_Italic",
  sans: "PlusJakartaSans_400Regular",
  sansMedium: "PlusJakartaSans_500Medium",
  sansSemibold: "PlusJakartaSans_600SemiBold"
} as const;

/** Nine steps, each with one job. 11 is the floor. */
export const text = {
  displayLg: { fontFamily: font.serifLight, fontSize: 34, lineHeight: 42 },
  display: { fontFamily: font.serifLight, fontSize: 27, lineHeight: 35 },
  title: { fontFamily: font.serif, fontSize: 23, lineHeight: 32 },
  heading: { fontFamily: font.sansMedium, fontSize: 19, lineHeight: 26 },
  bodyLg: { fontFamily: font.serif, fontSize: 17, lineHeight: 27 },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 23 },
  label: { fontFamily: font.sansSemibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.sans, fontSize: 12, lineHeight: 17 },
  eyebrow: {
    fontFamily: font.sansSemibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.6
  }
} satisfies Record<string, TextStyle>;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  /** the one screen gutter — it does not vary by screen */
  gutter: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 56
} as const;

export const radius = {
  tag: 8,
  well: 12,
  group: 16,
  card: 20,
  pill: 999
} as const;

/** Shadows carry the forest tint — a neutral shadow reads as dirt on parchment. */
export const elevation = {
  flat: { borderWidth: 1, borderColor: color.hairline } as ViewStyle,
  raised: Platform.select({
    ios: {
      shadowColor: "#1C2E14",
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.08,
      shadowRadius: 16
    },
    android: { elevation: 3 },
    default: { boxShadow: "0 7px 22px rgba(28,46,20,0.08)" }
  }) as ViewStyle,
  lifted: Platform.select({
    ios: {
      shadowColor: "#1C2E14",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18
    },
    android: { elevation: 5 },
    default: { boxShadow: "0 10px 28px rgba(28,46,20,0.12)" }
  }) as ViewStyle
};

/** Nothing bounces, flashes or celebrates. */
export const motion = {
  ambientDrift: 9000,
  ambientBreath: 3200,
  enterSoft: 650,
  reactTap: 260,
  reactSpring: { damping: 9, stiffness: 130 },
  returnSpring: { damping: 12, stiffness: 120 }
} as const;

export const target = {
  /** minimum tappable edge, in points */
  min: 44,
  navItem: { width: 88, height: 44 },
  control: 52
} as const;
