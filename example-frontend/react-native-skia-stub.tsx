import React, {forwardRef, useRef} from "react";
import {View, type ViewProps} from "react-native";

// Temporary stub until the dev client is rebuilt with @shopify/react-native-skia.

export const ImageFormat = {
  PNG: "png",
};

export const Skia = {
  Path: {
    MakeFromSVGString: (_svg: string): null => null,
  },
};

export const useCanvasRef = (): React.RefObject<{makeImageSnapshot: () => null}> =>
  useRef({
    makeImageSnapshot: () => null,
  });

interface CanvasProps extends ViewProps {
  children?: React.ReactNode;
}

export const Canvas = forwardRef<View, CanvasProps>(({children, style, ...rest}, _ref) => (
  <View style={style} {...rest}>
    {children}
  </View>
));

Canvas.displayName = "SkiaCanvasStub";

export const Path = (): null => null;
