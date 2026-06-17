import {type FC, useCallback, useEffect, useRef, useState} from "react";
import {
  Dimensions,
  type LayoutChangeEvent,
  type LayoutRectangle,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {Portal} from "react-native-portalize";
import {Button} from "./Button";
import type {IconName, TooltipPosition} from "./Common";
import {Heading} from "./Heading";
import {IconButton} from "./IconButton";
import {Text} from "./Text";
import {useTheme} from "./Theme";

const POPOVER_OFFSET = 8;
const POPOVER_OVERFLOW_PADDING = 20;
const POPOVER_WIDTH = 280;
// Distance in pixels a touch on the backdrop may travel before it is treated as a scroll attempt.
const SCROLL_DISMISS_SLOP = 8;

interface TriggerMeasurement {
  height: number;
  pageX: number;
  pageY: number;
  width: number;
}

interface PopoverMeasurement {
  children: TriggerMeasurement | Record<string, never>;
  measured: boolean;
  tooltip: LayoutRectangle | Record<string, never>;
}

const getPopoverPosition = (
  {children, tooltip, measured}: PopoverMeasurement,
  idealPosition: TooltipPosition
): Record<string, never> | {left: number; top: number} => {
  if (!measured) {
    return {};
  }

  const {pageY: cy, height: ch, pageX: cx, width: cw} = children as TriggerMeasurement;
  const {width: tw, height: th} = tooltip as LayoutRectangle;
  const screenW = Dimensions.get("window").width;
  const screenH = Dimensions.get("window").height;

  const hCenter = cx + cw / 2;
  const topPos = cy - th - POPOVER_OFFSET;
  const bottomPos = cy + ch + POPOVER_OFFSET;
  const leftPos = cx - tw - POPOVER_OFFSET;
  const rightPos = cx + cw + POPOVER_OFFSET;
  const vertCenter = cy + ch / 2 - th / 2;

  const clampH = (l: number) =>
    Math.min(Math.max(l, POPOVER_OVERFLOW_PADDING), screenW - tw - POPOVER_OVERFLOW_PADDING);

  const canTop = topPos >= POPOVER_OVERFLOW_PADDING;
  const canBottom = bottomPos + th <= screenH - POPOVER_OVERFLOW_PADDING;
  const canLeft = leftPos >= POPOVER_OVERFLOW_PADDING;
  const canRight = rightPos + tw <= screenW - POPOVER_OVERFLOW_PADDING;

  const positions: Record<TooltipPosition, () => {left: number; top: number}> = {
    bottom: () => ({left: clampH(hCenter - tw / 2), top: bottomPos}),
    left: () => ({left: leftPos, top: vertCenter}),
    right: () => ({left: rightPos, top: vertCenter}),
    top: () => ({left: clampH(hCenter - tw / 2), top: topPos}),
  };

  const viable: Record<TooltipPosition, boolean> = {
    bottom: canBottom,
    left: canLeft,
    right: canRight,
    top: canTop,
  };

  const order: TooltipPosition[] = [idealPosition, "top", "bottom", "left", "right"];
  for (const pos of order) {
    if (viable[pos]) {
      return positions[pos]();
    }
  }

  return positions.bottom();
};

export interface CitationTooltipAction {
  iconName?: IconName;
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "muted" | "outline" | "destructive";
}

export interface CitationTooltipProps {
  /**
   * Action buttons shown in the footer of the citation popover.
   */
  actions?: CitationTooltipAction[];

  /**
   * The scrollable main body of the citation popover. Accepts a string or any React node.
   */
  content: React.ReactNode;

  /**
   * Whether the popover dismisses when the user scrolls (or attempts to scroll) outside of it.
   * Scrolling the popover's own content area never dismisses.
   *
   * When false, no blocking backdrop is rendered so the page scrolls freely while the popover
   * stays open. On web, outside clicks still dismiss (via a document listener). On native,
   * outside taps interact with the page directly — close via the marker or the close button.
   * @default true
   */
  dismissOnScroll?: boolean;

  /**
   * The header text shown at the top of the citation popover.
   */
  header: string;

  /**
   * Preferred position for the popover. Falls back to the best available position.
   * @default "top"
   */
  idealPosition?: TooltipPosition;

  /**
   * The inline marker text (e.g. "1", "2", "A") shown as the trigger badge.
   */
  marker: string;

  /**
   * Maximum height of the scrollable content area in pixels.
   * @default 150
   */
  maxContentHeight?: number;

  /**
   * Called when the thumbs down feedback button is pressed. When provided, a thumbs down icon
   * button is shown on the right side of the footer.
   */
  onThumbsDown?: () => void | Promise<void>;

  /**
   * Called when the thumbs up feedback button is pressed. When provided, a thumbs up icon
   * button is shown on the right side of the footer.
   */
  onThumbsUp?: () => void | Promise<void>;
}

export const CitationTooltip: FC<CitationTooltipProps> = ({
  actions = [],
  content,
  dismissOnScroll = true,
  header,
  idealPosition = "top",
  marker,
  maxContentHeight = 150,
  onThumbsDown,
  onThumbsUp,
}) => {
  const {theme} = useTheme();
  const isWeb = Platform.OS === "web";

  const [visible, setVisible] = useState(false);
  const [measurement, setMeasurement] = useState<PopoverMeasurement>({
    children: {},
    measured: false,
    tooltip: {},
  });

  const triggerRef = useRef<View>(null);
  const popoverRef = useRef<View>(null);
  const isPointerInPopover = useRef(false);
  const backdropTouchStart = useRef<{x: number; y: number} | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    setMeasurement({children: {}, measured: false, tooltip: {}});
  }, []);

  const toggle = useCallback(() => {
    if (visible) {
      dismiss();
    } else {
      setVisible(true);
    }
  }, [visible, dismiss]);

  // Web: dismiss on scroll or wheel events that originate outside the popover. Wheel is needed
  // in addition to scroll so that a scroll attempt still dismisses when the page has nothing to
  // scroll (no scroll event fires in that case).
  useEffect(() => {
    if (!isWeb || !visible || !dismissOnScroll) {
      return;
    }
    const handleScrollAttempt = () => {
      if (!isPointerInPopover.current) {
        dismiss();
      }
    };
    document.addEventListener("scroll", handleScrollAttempt, true);
    document.addEventListener("wheel", handleScrollAttempt, true);
    return () => {
      document.removeEventListener("scroll", handleScrollAttempt, true);
      document.removeEventListener("wheel", handleScrollAttempt, true);
    };
  }, [isWeb, visible, dismissOnScroll, dismiss]);

  // Re-measures the trigger so the popover stays anchored to it as the page moves. Keeps the
  // already-measured popover layout; only the trigger coordinates change.
  const refreshAnchorPosition = useCallback(() => {
    if (!triggerRef.current?.measure) {
      return;
    }
    triggerRef.current.measure((_x, _y, width, height, pageX, pageY) => {
      setMeasurement((prev) => {
        if (!prev.measured) {
          return prev;
        }
        return {...prev, children: {height, pageX, pageY, width}};
      });
    });
  }, []);

  // Web: keep the popover anchored to its trigger while the page scrolls, throttled to one
  // re-measure per animation frame. Without this, a popover that stays open during scroll
  // (dismissOnScroll=false) would wander away from its marker.
  useEffect(() => {
    if (!isWeb || !visible) {
      return;
    }
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        refreshAnchorPosition();
      });
    };
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isWeb, visible, refreshAnchorPosition]);

  // Web, non-dismissing mode: no backdrop is rendered so the page scrolls freely. Outside
  // clicks are detected with a document listener instead, checking the event target against
  // the popover and trigger DOM nodes.
  useEffect(() => {
    if (!isWeb || !visible || dismissOnScroll) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const popoverNode = popoverRef.current as unknown as HTMLElement | null;
      const triggerNode = triggerRef.current as unknown as HTMLElement | null;
      const target = event.target as Node;
      if (popoverNode?.contains?.(target) || triggerNode?.contains?.(target)) {
        return;
      }
      dismiss();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isWeb, visible, dismissOnScroll, dismiss]);

  useEffect(() => {
    return () => {
      setVisible(false);
    };
  }, []);

  const handlePopoverLayout = useCallback(({nativeEvent: {layout}}: LayoutChangeEvent) => {
    if (!triggerRef.current?.measure) {
      return;
    }
    triggerRef.current.measure((_x, _y, width, height, pageX, pageY) => {
      setMeasurement({
        children: {height, pageX, pageY, width},
        measured: true,
        tooltip: {...layout},
      });
    });
  }, []);

  const position = getPopoverPosition(measurement, idealPosition);

  return (
    <View style={{alignSelf: "flex-start"}}>
      {visible && (
        <Portal>
          {/* Full-screen backdrop dismisses on outside click or scroll attempt. Only rendered
              in dismiss-on-scroll mode — when dismissOnScroll is false it would swallow the
              scroll gesture, so outside interaction is handled without an overlay instead. */}
          {dismissOnScroll && (
            <Pressable
              onPress={dismiss}
              onTouchEnd={() => {
                backdropTouchStart.current = null;
              }}
              onTouchMove={({nativeEvent}) => {
                if (!backdropTouchStart.current) {
                  return;
                }
                const dx = Math.abs(nativeEvent.pageX - backdropTouchStart.current.x);
                const dy = Math.abs(nativeEvent.pageY - backdropTouchStart.current.y);
                if (dx > SCROLL_DISMISS_SLOP || dy > SCROLL_DISMISS_SLOP) {
                  backdropTouchStart.current = null;
                  dismiss();
                }
              }}
              onTouchStart={({nativeEvent}) => {
                backdropTouchStart.current = {x: nativeEvent.pageX, y: nativeEvent.pageY};
              }}
              style={{bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 998}}
              testID="citation-tooltip-backdrop"
            />
          )}

          {/* Popover panel */}
          <View
            onLayout={handlePopoverLayout}
            onPointerEnter={() => {
              isPointerInPopover.current = true;
            }}
            onPointerLeave={() => {
              isPointerInPopover.current = false;
            }}
            ref={popoverRef}
            style={{
              backgroundColor: theme.surface.base,
              borderColor: theme.border.default,
              borderRadius: theme.radius.default as unknown as number,
              borderWidth: 1,
              elevation: 8,
              maxWidth: POPOVER_WIDTH,
              minWidth: 200,
              opacity: measurement.measured ? 1 : 0,
              overflow: "hidden",
              position: "absolute",
              shadowColor: "#000",
              shadowOffset: {height: 4, width: 0},
              shadowOpacity: 0.12,
              shadowRadius: 12,
              width: POPOVER_WIDTH,
              zIndex: 999,
              ...position,
            }}
            testID="citation-tooltip-popover"
          >
            {/* Inner pressable prevents backdrop from capturing taps inside the panel */}
            <Pressable onPress={() => {}}>
              {/* Header */}
              <View
                style={{
                  alignItems: "center",
                  borderBottomColor: theme.border.default,
                  borderBottomWidth: 1,
                  flexDirection: "row",
                  gap: 8,
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Heading size="sm">{header}</Heading>
                <IconButton
                  accessibilityHint="Close citation"
                  accessibilityLabel="close"
                  iconName="xmark"
                  onClick={dismiss}
                  variant="muted"
                />
              </View>

              {/* Scrollable content area */}
              <ScrollView
                contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 10}}
                showsVerticalScrollIndicator
                style={{maxHeight: maxContentHeight}}
              >
                {typeof content === "string" ? <Text size="sm">{content}</Text> : content}
              </ScrollView>

              {/* Footer — only rendered when actions or feedback handlers are provided */}
              {(actions.length > 0 || Boolean(onThumbsUp) || Boolean(onThumbsDown)) && (
                <View
                  style={{
                    alignItems: "center",
                    borderTopColor: theme.border.default,
                    borderTopWidth: 1,
                    flexDirection: "row",
                    gap: 8,
                    justifyContent: "space-between",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <View style={{flexDirection: "row", flexShrink: 1, flexWrap: "wrap", gap: 8}}>
                    {actions.map((action, index) => (
                      <Button
                        iconName={action.iconName}
                        key={index}
                        onClick={action.onClick}
                        text={action.label}
                        variant={action.variant ?? "secondary"}
                      />
                    ))}
                  </View>
                  {(Boolean(onThumbsUp) || Boolean(onThumbsDown)) && (
                    <View style={{flexDirection: "row", gap: 4}}>
                      {onThumbsUp && (
                        <IconButton
                          accessibilityHint="Mark this citation as helpful"
                          accessibilityLabel="thumbs up"
                          iconName="thumbs-up"
                          onClick={onThumbsUp}
                          testID="citation-tooltip-thumbs-up"
                          variant="muted"
                        />
                      )}
                      {onThumbsDown && (
                        <IconButton
                          accessibilityHint="Mark this citation as not helpful"
                          accessibilityLabel="thumbs down"
                          iconName="thumbs-down"
                          onClick={onThumbsDown}
                          testID="citation-tooltip-thumbs-down"
                          variant="muted"
                        />
                      )}
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        </Portal>
      )}

      {/* Inline citation marker badge */}
      <Pressable onPress={toggle} ref={triggerRef} testID="citation-tooltip-trigger">
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.surface.primary,
            borderRadius: 20,
            justifyContent: "center",
            marginBottom: 4,
            minWidth: 18,
            paddingHorizontal: 5,
            paddingVertical: 1,
          }}
        >
          <Text bold color="inverted" size="sm">
            {marker}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};
