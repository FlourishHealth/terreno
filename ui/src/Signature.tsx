import {
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {Text, View} from "react-native";

import {useTheme} from "./Theme";

export interface SignatureProps {
  onChange: (signature: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  fullWidth?: boolean;
  value?: string; // note this
}

const SIGNATURE_WIDTH_PX = 300;
const SIGNATURE_HEIGHT_PX = 180;
const STROKE_WIDTH_PX = 2.5;

interface CanvasPoint {
  x: number;
  y: number;
}

type DrawingEvent = ReactMouseEvent<HTMLCanvasElement> | ReactPointerEvent<HTMLCanvasElement>;

/**
 * Web signature pad backed by a raw HTML5 <canvas> — no third-party library.
 *
 * Pointer events capture strokes and the canvas is exported as a base64 PNG
 * data URL via onChange. Clearing pushes "" so "signature required" gating in
 * parents resets immediately, since clearing the canvas emits no draw event.
 */
export const Signature = ({
  fullWidth = false,
  onChange,
  onStart,
  onEnd,
}: SignatureProps): ReactElement => {
  const {theme} = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  const getContext = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getContext !== "function") {
      return null;
    }
    return canvas.getContext("2d");
  }, []);

  const getCanvasPoint = useCallback((event: DrawingEvent): CanvasPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect?.();
    const displayWidth = rect?.width ?? canvas.clientWidth ?? canvas.width;
    const displayHeight = rect?.height ?? canvas.clientHeight ?? canvas.height;
    if (displayWidth <= 0 || displayHeight <= 0) {
      return {
        x: event.nativeEvent.offsetX,
        y: event.nativeEvent.offsetY,
      };
    }

    return {
      x: (event.nativeEvent.offsetX / displayWidth) * canvas.width,
      y: (event.nativeEvent.offsetY / displayHeight) * canvas.height,
    };
  }, []);

  /**
   * Paints the opaque background and configures stroke styling. Re-runs when
   * the theme changes so the pad matches the active light/dark colors.
   */
  const resetCanvas = useCallback((): void => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) {
      return;
    }
    ctx.fillStyle = theme.surface.base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = theme.text.secondaryDark;
    ctx.lineWidth = STROKE_WIDTH_PX;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [getContext, theme.surface.base, theme.text.secondaryDark]);

  // Initialize the canvas background and stroke styling once the element mounts.
  useEffect((): void => {
    resetCanvas();
  }, [resetCanvas]);

  const handlePointerDown = useCallback(
    (event: DrawingEvent): void => {
      const ctx = getContext();
      const point = getCanvasPoint(event);
      if (!ctx || !point) {
        return;
      }
      if ("pointerId" in event) {
        canvasRef.current?.setPointerCapture?.(event.pointerId);
      }
      isDrawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      onStart?.();
    },
    [getCanvasPoint, getContext, onStart]
  );

  const handlePointerMove = useCallback(
    (event: DrawingEvent): void => {
      if (!isDrawingRef.current) {
        return;
      }
      const ctx = getContext();
      const point = getCanvasPoint(event);
      if (!ctx || !point) {
        return;
      }
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      hasDrawnRef.current = true;
    },
    [getCanvasPoint, getContext]
  );

  const handlePointerUp = useCallback(
    (event: DrawingEvent): void => {
      if (!isDrawingRef.current) {
        return;
      }
      isDrawingRef.current = false;
      if ("pointerId" in event) {
        canvasRef.current?.releasePointerCapture?.(event.pointerId);
      }
      const canvas = canvasRef.current;
      if (hasDrawnRef.current && canvas) {
        onChange(canvas.toDataURL("image/png"));
      }
      onEnd?.();
    },
    [onChange, onEnd]
  );

  const handleClear = useCallback((): void => {
    hasDrawnRef.current = false;
    isDrawingRef.current = false;
    resetCanvas();
    // Clearing the canvas emits no draw event, so notify the parent directly
    // to reset any "signature required" gating.
    onChange("");
  }, [resetCanvas, onChange]);

  return (
    <View>
      <View
        style={{
          borderColor: theme.border.dark,
          borderWidth: 1,
          maxWidth: fullWidth ? undefined : SIGNATURE_WIDTH_PX,
          width: "100%",
        }}
      >
        <canvas
          height={SIGNATURE_HEIGHT_PX}
          onMouseDown={handlePointerDown}
          onMouseLeave={handlePointerUp}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerLeave={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={canvasRef}
          style={{
            display: "block",
            height: SIGNATURE_HEIGHT_PX,
            maxWidth: "100%",
            touchAction: "none",
            width: "100%",
          }}
          width={SIGNATURE_WIDTH_PX}
        />
      </View>
      <View>
        <Text
          onPress={handleClear}
          style={{color: theme.text.link, textDecorationLine: "underline"}}
        >
          Clear
        </Text>
      </View>
    </View>
  );
};
