import {type FC, useRef, useState} from "react";
import {Platform, Pressable, View} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import type {FilterProps} from "./Common";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {resolveTestID} from "./testing/resolveTestId";

const DEFAULT_WIDTH = 320;
const TRIGGER_OFFSET = 44;

/**
 * Compositional filter dropdown. Renders a trigger button that opens a panel
 * containing composed filter controls (`FilterSelectMenu`, `FilterBoolean`,
 * `FilterAccordion`, or any custom content) plus an optional Apply / Clear /
 * Cancel footer. Clicking outside the panel closes it. Desktop web only.
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
  const triggerRef = useRef<View>(null);

  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

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

  return (
    // Raising the whole subtree's stacking context while open keeps the opaque
    // panel above sibling content so nothing bleeds through it.
    <View style={{position: "relative", zIndex: open ? 1000 : undefined}} testID={testID}>
      <View ref={triggerRef}>
        <Button
          iconName={iconName}
          onClick={() => setOpen(!open)}
          testID={testID ? resolveTestID(testID, "trigger") : undefined}
          text={label}
          variant={variant}
        />
      </View>
      {Boolean(open) && (
        <>
          {/* Transparent full-screen backdrop closes the panel on outside click. */}
          <Box
            accessibilityHint="Closes the filter dropdown"
            accessibilityLabel="Close filter"
            bottom
            left
            onClick={handleCancel}
            position="fixed"
            right
            testID={testID ? resolveTestID(testID, "backdrop") : undefined}
            top
            zIndex={10}
          />
          <View
            style={{
              backgroundColor: theme.surface.base,
              borderColor: theme.border.default,
              borderRadius: theme.radius.default,
              borderWidth: 1,
              left: 0,
              opacity: 1,
              position: "absolute",
              shadowColor: theme.primitives.neutral900,
              shadowOffset: {height: 4, width: 0},
              shadowOpacity: 0.15,
              shadowRadius: 12,
              top: TRIGGER_OFFSET,
              width,
              zIndex: 11,
            }}
            testID={testID ? resolveTestID(testID, "panel") : undefined}
          >
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
          </View>
        </>
      )}
    </View>
  );
};
