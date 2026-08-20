import type React from "react";
import Svg, {Rect, type SvgProps} from "react-native-svg";

/**
 * Solid "bars-filter" icon (FontAwesome Classic Solid, E0AD). FontAwesome 6 free
 * has no `bars-filter` glyph (it is a Pro icon), so it is composed locally from
 * three centered, rounded horizontal bars of decreasing width. Defaults to
 * 16x16 — pass `height`/`width` to resize and `fill` to recolor.
 */
export const BarsFilterIcon = (props: SvgProps): React.ReactElement => {
  return (
    <Svg fill="currentColor" height={16} viewBox="0 0 512 512" width={16} {...props}>
      <Rect height={56} rx={28} width={512} x={0} y={120} />
      <Rect height={56} rx={28} width={320} x={96} y={228} />
      <Rect height={56} rx={28} width={160} x={176} y={336} />
    </Svg>
  );
};
