import {type FC, type ReactNode, useEffect, useState} from "react";
import {Platform, Pressable, View, type ViewStyle} from "react-native";

import {Button} from "./Button";
import type {FilterProps} from "./Common";
import {createWebPortal} from "./createWebPortal";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {resolveTestID} from "./testing/resolveTestId";
import {useWebDropdownAnchor} from "./WebDropdownMenu";

const DEFAULT_WIDTH = 320;
const TRIGGER_OFFSET = 44;
const PANEL_GAP = 4;

/**
 * Compositional filter dropdown. Renders a trigger button that opens a panel
 * containing composed filter controls (`FilterSelectMenu`, `FilterBoolean`,
 * `FilterAccordion`, or any custom content) plus an optional Apply / Clear /
 * Cancel footer. Clicking outside the panel closes it. Desktop web only.
 *
 * On web the panel is rendered in a portal on `document.body` and anchored to
 * the trigger, so it floats above all page content instead of being trapped in
 * a React Native Web stacking context (which would let content bleed through).
 */
export const Filter: FC<FilterProps> = ({
  children,
  label = "Filter",
  iconName = "bars-filter",
  isOpen,
  defaultOpen = false,
  onOpenChange,
  showActionButtons = true,
  showApplyButton = true,
  showClearButton = true,
  showCancelButton = true,
  applyButtonText = "Apply",
  clearButtonText = "Clear",
  cancelButtonText = "Cancel",
  onApply,
  onClear,
  onCancel,
  variant = "primary",
  width = DEFAULT_WIDTH,
  testID,
}) => {
  const {theme} = useTheme();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [anchorReady, setAnchorReady] = useState(false);
  const {anchor, measure, triggerRef} = useWebDropdownAnchor();

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  // Measure-then-show: measure the trigger when the panel opens and only reveal
  // the portaled panel once the anchor is known, so it never flashes at the
  // default (0, 0) position before jumping into place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-measure on open transitions; `measure` is recreated each render.
  useEffect(() => {
    if (open) {
      measure(() => setAnchorReady(true));
    } else {
      setAnchorReady(false);
    }
  }, [open]);

  // Return focus to the trigger after any in-panel dismissal so keyboard users
  // can continue from the control that opened the popup (web only).
  const restoreTriggerFocus = (): void => {
    if (Platform.OS !== "web" || !triggerRef.current) {
      return;
    }
    const node = triggerRef.current as unknown as {
      querySelector?: (selector: string) => {focus?: () => void} | null;
    };
    node.querySelector?.('[role="button"]')?.focus?.();
  };

  const setOpen = (next: boolean): void => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const handleApply = (): void => {
    onApply?.();
    setOpen(false);
    restoreTriggerFocus();
  };

  const handleClear = (): void => {
    onClear?.();
    setOpen(false);
    restoreTriggerFocus();
  };

  const handleCancel = (): void => {
    onCancel?.();
    setOpen(false);
    restoreTriggerFocus();
  };

  const showFooter = showActionButtons && (showApplyButton || showClearButton || showCancelButton);

  const panelSurfaceStyle: ViewStyle = {
    backgroundColor: theme.surface.base,
    borderColor: theme.border.default,
    borderRadius: theme.radius.default,
    borderWidth: 1,
    shadowColor: theme.primitives.neutral900,
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    width,
  };

  const panelBody: ReactNode = (
    <>
      <View style={{padding: theme.spacing.sm}}>{children}</View>
      {showFooter && (
        <View
          style={{
            alignItems: "center",
            borderTopColor: theme.border.default,
            borderTopWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: theme.spacing.md,
          }}
        >
          {showClearButton ? (
            <Pressable
              onPress={handleClear}
              testID={testID ? resolveTestID(testID, "clear") : undefined}
            >
              <Text color="link" underline>
                {clearButtonText}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: theme.spacing.sm,
              justifyContent: "flex-end",
            }}
          >
            {showCancelButton && (
              <Button
                onClick={handleCancel}
                testID={testID ? resolveTestID(testID, "cancel") : undefined}
                text={cancelButtonText}
                variant="outline"
              />
            )}
            {showApplyButton && (
              <Button
                onClick={handleApply}
                testID={testID ? resolveTestID(testID, "apply") : undefined}
                text={applyButtonText}
                variant={variant}
              />
            )}
          </View>
        </View>
      )}
    </>
  );

  const renderOverlay = (): ReactNode => {
    // Web: portal to document.body with fixed positioning so the panel escapes
    // every ancestor stacking context and floats above all page content.
    if (Platform.OS === "web" && typeof document !== "undefined") {
      // Wait for the trigger measurement so the panel appears already anchored.
      if (!anchorReady) {
        return null;
      }
      const overlay = (
        <View
          // box-none lets clicks pass to the backdrop / panel but not the empty overlay.
          pointerEvents="box-none"
          style={{inset: 0, position: "fixed", zIndex: 9999} as unknown as ViewStyle}
        >
          <Pressable
            aria-role="button"
            onPress={handleCancel}
            style={{inset: 0, position: "fixed", zIndex: 1} as unknown as ViewStyle}
            testID={testID ? resolveTestID(testID, "backdrop") : undefined}
          />
          <View
            style={
              {
                ...panelSurfaceStyle,
                left: anchor.x,
                position: "fixed",
                top: anchor.y + anchor.height + PANEL_GAP,
                zIndex: 2,
              } as unknown as ViewStyle
            }
            testID={testID ? resolveTestID(testID, "panel") : undefined}
          >
            {panelBody}
          </View>
        </View>
      );

      const target = document.body instanceof HTMLElement ? document.body : null;
      return target ? createWebPortal({children: overlay, container: target}) : overlay;
    }

    // Native fallback: anchored inline beneath the trigger.
    return (
      <>
        <Pressable
          aria-role="button"
          onPress={handleCancel}
          style={{bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 10}}
          testID={testID ? resolveTestID(testID, "backdrop") : undefined}
        />
        <View
          style={{
            ...panelSurfaceStyle,
            left: 0,
            position: "absolute",
            top: TRIGGER_OFFSET,
            zIndex: 11,
          }}
          testID={testID ? resolveTestID(testID, "panel") : undefined}
        >
          {panelBody}
        </View>
      </>
    );
  };

  return (
    <View style={{position: "relative"}} testID={testID}>
      <View ref={triggerRef}>
        <Button
          iconName={iconName}
          onClick={() => setOpen(!open)}
          testID={testID ? resolveTestID(testID, "trigger") : undefined}
          text={label}
          variant={variant}
        />
      </View>
      {Boolean(open) && renderOverlay()}
    </View>
  );
};
