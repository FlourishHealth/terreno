import {Platform} from "react-native";

/**
 * Apple HIG recommends a 44x44pt hit target for controls, which also satisfies
 * WCAG 2.5.5 (AAA). Applied as a minimum rather than a fixed height so wrapped
 * labels and Dynamic Type / fontScale can grow a control instead of clipping it.
 */
export const CONTROL_MIN_HEIGHT = 44;

/**
 * Apple's documented iOS minimum control size, used by the intentionally dense
 * `size="sm"` controls meant for desktop, data-heavy screens.
 */
export const CONTROL_SM_MIN_HEIGHT = 28;

/** Android Material recommends 48dp, which may extend past the visual bounds. */
export const TOUCH_TARGET_MIN = 48;

export interface ControlHitSlop {
  bottom: number;
  top: number;
}

/**
 * Vertical hit slop that grows a control's touch area to Material's 48dp
 * recommendation without changing its visual height or layout footprint.
 *
 * Returns undefined on web, where react-native-web does not implement hitSlop
 * (padding or a transparent border is the only way to expand a web hit area).
 * Web therefore relies on the visual size of the control.
 */
export const controlHitSlop = (visualHeight: number): ControlHitSlop | undefined => {
  if (Platform.OS === "web") {
    return undefined;
  }

  const missing = TOUCH_TARGET_MIN - visualHeight;
  if (missing <= 0) {
    return undefined;
  }

  const slop = Math.ceil(missing / 2);
  return {bottom: slop, top: slop};
};
