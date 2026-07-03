import type {TerrenoThemeConfig} from "@terreno/ui";

/**
 * Dark-mode support for the palette preview. Terreno ships a single light theme, so a dark theme is
 * produced by REMAPPING semantic roles to darker primitives (not by inverting the neutral ramp).
 * `text.inverted` is intentionally kept light because many components use it as "text on a colored
 * surface" — see `DARK_MODE_AUDIT` for the components that do and do not adapt cleanly.
 */

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Role → primitive remapping applied (via `setTheme`) to the nested preview provider for dark mode.
 * Covers the surface/text/border/status roles that most components read.
 */
export const DARK_THEME_CONFIG: DeepPartial<TerrenoThemeConfig> = {
  border: {
    activeAccent: "accent300",
    activeNeutral: "neutral300",
    dark: "neutral500",
    default: "neutral700",
    error: "error100",
    focus: "primary300",
    hover: "neutral600",
    success: "success100",
    warning: "warning100",
  },
  status: {
    active: "success100",
    away: "neutral400",
    doNotDisturb: "error100",
  },
  surface: {
    base: "neutral900",
    disabled: "neutral600",
    error: "error200",
    errorLight: "error000",
    neutral: "neutral600",
    neutralDark: "neutral700",
    neutralLight: "neutral800",
    primary: "primary400",
    secondaryDark: "secondary400",
    secondaryExtraDark: "secondary200",
    secondaryLight: "secondary700",
    success: "success200",
    successLight: "success000",
    warning: "warning100",
    warningLight: "warning000",
  },
  text: {
    accent: "accent200",
    error: "error100",
    extraLight: "neutral400",
    // Kept light on purpose — this role sits on colored/dark surfaces across the library.
    inverted: "neutral000",
    link: "primary200",
    linkLight: "primary300",
    primary: "neutral000",
    secondaryDark: "secondary100",
    secondaryLight: "neutral300",
    success: "success100",
    warning: "warning100",
  },
};

export type DarkModeStatus = "adapts" | "partial" | "breaks";

export interface DarkModeAuditItem {
  area: string;
  status: DarkModeStatus;
  detail: string;
}

/**
 * Findings from auditing `@terreno/ui` for dark-mode readiness. Most components read semantic theme
 * tokens and adapt when roles are remapped; the entries below call out where a naive dark theme
 * still breaks because of hardcoded colors or light-surface assumptions in the library source.
 */
export const DARK_MODE_AUDIT: DarkModeAuditItem[] = [
  {
    area: "Layout, typography & forms",
    detail:
      "Box, Card, Page, Text, Heading, TextField, SelectField, DataTable, Accordion and most components read theme.surface / theme.text and re-theme correctly.",
    status: "adapts",
  },
  {
    area: "text.inverted role",
    detail:
      "Mapped to the lightest neutral and used as 'text on colored surfaces' (Button, Badge, Banner, Toast, Tooltip, Avatar). Kept light here so it stays legible — inverting the neutral ramp instead would break all of these.",
    status: "partial",
  },
  {
    area: "Button / Badge / Banner text",
    detail:
      "Labels use text.inverted on saturated fills. Fine as long as the colored surface stays dark enough for white text (watch the WCAG flags for primary/warning).",
    status: "partial",
  },
  {
    area: "Spinner",
    detail:
      'color="light"/"dark" read raw neutral primitives, not semantic roles, so the variant names assume a light background. Pass an explicit color on dark surfaces.',
    status: "partial",
  },
  {
    area: "Modal / ActionSheet / mobile pickers",
    detail:
      "Overlays and iOS picker chrome hardcode white backgrounds and rgba(0,0,0,…) scrims/shadows (Modal.tsx, ActionSheet.tsx, PickerSelect.tsx). These stay light in dark mode.",
    status: "breaks",
  },
  {
    area: "Box/Card shadow & Slider thumb",
    detail:
      "Box shadow uses a fixed gray and the web Slider thumb is hardcoded white with a black shadow, so elevation reads oddly on dark surfaces.",
    status: "breaks",
  },
  {
    area: "IconButton muted/navigation/destructive",
    detail:
      "These variants use theme.text.inverted (white) as the button background, so the pill stays white on a dark page.",
    status: "breaks",
  },
  {
    area: "Banner inner action button text",
    detail:
      "Renders a raw React Native Text with no theme color on a surface.base pill, so the label can disappear when surface.base is dark.",
    status: "breaks",
  },
];
