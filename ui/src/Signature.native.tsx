import {Canvas, ImageFormat, Path, Skia, useCanvasRef} from "@shopify/react-native-skia";
import {type FC, useCallback, useMemo, useRef, useState} from "react";
import {Platform, Text, View} from "react-native";
import {Gesture, GestureDetector} from "react-native-gesture-handler";

import {getSignaturePadHeight} from "./SignatureSizing";
import {useTheme} from "./Theme";

interface Props {
  onChange: (signature: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  fullWidth?: boolean;
}

const STROKE_WIDTH_PX = 2.5;
// Snapshot after the released stroke has painted to the Skia canvas.
const SNAPSHOT_DELAY_MS = 60;

/**
 * Native (iOS + Android) signature pad backed by Skia — no WebView.
 *
 * Replaces the previous react-native-signature-canvas WebView, which on iOS
 * stayed on `about:blank` (its signature_pad script never loaded, so onOK
 * never fired). Skia draws strokes natively and exports a PNG via
 * makeImageSnapshot, which behaves consistently across both platforms.
 *
 * Touches are captured with react-native-gesture-handler rather than
 * PanResponder because the Skia <Canvas> renders a native view that swallows
 * React Native's JS touch responder.
 *
 * Reports the signature to the parent as a base64 PNG data URL via onChange,
 * and pushes "" on clear so "signature required" gating resets immediately.
 */
export const Signature: FC<Props> = ({fullWidth = false, onChange, onStart, onEnd}: Props) => {
  const {theme} = useTheme();
  const canvasRef = useCanvasRef();
  const signaturePadHeight = getSignaturePadHeight(Platform.OS);
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Completed strokes as SVG path strings; the active stroke is tracked separately.
  const [completedStrokes, setCompletedStrokes] = useState<string[]>([]);
  const [activeStroke, setActiveStroke] = useState<string | null>(null);
  const activeStrokeRef = useRef<string | null>(null);

  const clearSnapshotTimer = useCallback((): void => {
    if (snapshotTimerRef.current !== null) {
      clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
  }, []);

  /**
   * Snapshots the Skia canvas and reports a PNG data URL. Runs after a short
   * delay so the just-completed stroke is painted before the snapshot.
   */
  const captureSignature = useCallback((): void => {
    clearSnapshotTimer();
    snapshotTimerRef.current = setTimeout(() => {
      const image = canvasRef.current?.makeImageSnapshot();
      if (!image) {
        return;
      }
      const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
      if (base64 && base64.length > 0) {
        onChange(`data:image/png;base64,${base64}`);
      }
    }, SNAPSHOT_DELAY_MS);
  }, [canvasRef, clearSnapshotTimer, onChange]);

  const beginStroke = useCallback(
    (x: number, y: number): void => {
      const next = `M${x.toFixed(2)} ${y.toFixed(2)}`;
      activeStrokeRef.current = next;
      setActiveStroke(next);
      onStart?.();
    },
    [onStart]
  );

  const extendStroke = useCallback((x: number, y: number): void => {
    const prev = activeStrokeRef.current;
    if (prev === null) {
      return;
    }
    const next = `${prev} L${x.toFixed(2)} ${y.toFixed(2)}`;
    activeStrokeRef.current = next;
    setActiveStroke(next);
  }, []);

  const endStroke = useCallback((): void => {
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setActiveStroke(null);
    // A tap without movement has no line segment, so there is nothing to capture.
    if (finished === null || !finished.includes("L")) {
      return;
    }
    setCompletedStrokes((prev) => [...prev, finished]);
    captureSignature();
    onEnd?.();
  }, [captureSignature, onEnd]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((event) => {
          beginStroke(event.x, event.y);
        })
        .onUpdate((event) => {
          extendStroke(event.x, event.y);
        })
        .onEnd(() => {
          endStroke();
        })
        .onFinalize(() => {
          // Covers cancellation paths where onEnd does not fire.
          if (activeStrokeRef.current !== null) {
            endStroke();
          }
        }),
    [beginStroke, extendStroke, endStroke]
  );

  const skiaPaths = useMemo(() => {
    const allStrokes = activeStroke ? [...completedStrokes, activeStroke] : completedStrokes;
    return allStrokes
      .map((svg) => Skia.Path.MakeFromSVGString(svg))
      .filter((path): path is NonNullable<typeof path> => path !== null);
  }, [completedStrokes, activeStroke]);

  const handleClear = useCallback((): void => {
    clearSnapshotTimer();
    activeStrokeRef.current = null;
    setActiveStroke(null);
    setCompletedStrokes([]);
    // clearing must reset parent gating, mirroring the web Signature variant.
    onChange("");
  }, [clearSnapshotTimer, onChange]);

  return (
    <View style={{minWidth: 220, width: fullWidth ? "100%" : undefined}}>
      <GestureDetector gesture={panGesture}>
        <View
          style={{
            backgroundColor: theme.surface.base,
            borderColor: theme.border.dark,
            borderWidth: 1,
            height: signaturePadHeight,
            overflow: "hidden",
          }}
        >
          <Canvas ref={canvasRef} style={{flex: 1}}>
            {skiaPaths.map((path, index) => (
              <Path
                color={theme.text.secondaryDark}
                // Strokes are append-only, so the index is a stable key here.
                key={index}
                path={path}
                strokeCap="round"
                strokeJoin="round"
                strokeWidth={STROKE_WIDTH_PX}
                style="stroke"
              />
            ))}
          </Canvas>
        </View>
      </GestureDetector>
      <View style={{flexDirection: "row"}}>
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
