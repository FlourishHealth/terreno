import type React from "react";
import Svg, {Path, type SvgProps} from "react-native-svg";

/**
 * Builds a four-pointed sparkle path with concave edges, centered at (cx, cy) with
 * outer radius r. FontAwesome 6 free has no standalone `sparkles` glyph (it is a Pro
 * icon), so the glyph is composed locally from three of these sparkle shapes.
 */
const sparklePath = (cx: number, cy: number, r: number): string => {
  const pinch = r * 0.16;
  return [
    `M ${cx} ${cy - r}`,
    `Q ${cx + pinch} ${cy - pinch} ${cx + r} ${cy}`,
    `Q ${cx + pinch} ${cy + pinch} ${cx} ${cy + r}`,
    `Q ${cx - pinch} ${cy + pinch} ${cx - r} ${cy}`,
    `Q ${cx - pinch} ${cy - pinch} ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
};

/** One large sparkle with two smaller companions, mirroring Font Awesome's sparkles layout. */
const SPARKLES_PATH = [
  sparklePath(200, 272, 200),
  sparklePath(420, 92, 88),
  sparklePath(420, 428, 80),
].join(" ");

/**
 * Solid "sparkles" icon (three four-pointed stars). Defaults to 16x16 — pass
 * `height`/`width` to resize and `fill` to recolor.
 */
export const SparklesIcon = (props: SvgProps): React.ReactElement => {
  return (
    <Svg fill="currentColor" height={16} viewBox="0 0 512 512" width={16} {...props}>
      <Path d={SPARKLES_PATH} />
    </Svg>
  );
};
