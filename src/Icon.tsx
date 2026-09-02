import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * The product's icons, drawn rather than imported.
 *
 * @expo/vector-icons ships a 381 KB Ionicons font to draw fourteen glyphs —
 * forty per cent of the web build's payload. These are the same shapes
 * already documented in the design system: one 24 grid, 1.6 stroke, round
 * caps and joins, no fills. Matching the sheets by construction rather than
 * by resemblance.
 */

export type IconName =
  | "arrow-forward"
  | "arrow-back"
  | "chevron-forward"
  | "checkmark"
  | "circle"
  | "mic"
  | "sparkles"
  | "lock"
  | "moon"
  | "eye"
  | "home"
  | "stats"
  | "person"
  | "refresh";

export function Icon({
  name,
  size = 20,
  color = "#221E16"
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const stroke = { stroke: color, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "arrow-forward" ? (
        <>
          <Path d="M5 12h14" {...stroke} strokeWidth={2} />
          <Path d="M12 5l7 7-7 7" {...stroke} strokeWidth={2} />
        </>
      ) : null}

      {name === "arrow-back" ? (
        <>
          <Path d="M19 12H5" {...stroke} />
          <Path d="M12 19l-7-7 7-7" {...stroke} />
        </>
      ) : null}

      {name === "chevron-forward" ? <Path d="M9 18l6-6-6-6" {...stroke} strokeWidth={2} /> : null}

      {name === "checkmark" ? <Path d="M20 6L9 17l-5-5" {...stroke} strokeWidth={2.2} /> : null}

      {name === "circle" ? <Circle cx={12} cy={12} r={7} {...stroke} /> : null}

      {name === "mic" ? (
        <>
          <Path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" {...stroke} />
          <Path d="M5 11a7 7 0 0 0 14 0" {...stroke} />
          <Path d="M12 18v3" {...stroke} />
        </>
      ) : null}

      {name === "sparkles" ? <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" {...stroke} /> : null}

      {name === "lock" ? (
        <>
          <Rect x={4} y={10} width={16} height={10} rx={2} {...stroke} />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...stroke} />
        </>
      ) : null}

      {name === "moon" ? <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" {...stroke} /> : null}

      {name === "eye" ? (
        <>
          <Path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" {...stroke} />
          <Circle cx={12} cy={12} r={3} {...stroke} />
        </>
      ) : null}

      {name === "home" ? <Path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" {...stroke} /> : null}

      {name === "stats" ? (
        <>
          <Path d="M6 20V10" {...stroke} />
          <Path d="M12 20V4" {...stroke} />
          <Path d="M18 20v-6" {...stroke} />
        </>
      ) : null}

      {name === "person" ? (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" {...stroke} />
        </>
      ) : null}

      {name === "refresh" ? (
        <>
          <Path d="M21 12a9 9 0 1 1-3-6.7" {...stroke} />
          <Path d="M21 4v5h-5" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}
