/**
 * Vendored from react-native-toast-notifications v3.4.0
 * https://github.com/arnnis/react-native-toast-notifications
 *
 * MIT License
 *
 * Copyright (c) 2020 Alireza Rezania
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, {
  Component,
  createContext,
  type FC,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  type PanResponderGestureState,
  type PanResponderInstance,
  Platform,
  SafeAreaView,
  type ScaledSize,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from "react-native";

// ============================================================================
// useDimensions hook
// ============================================================================

function useDimensions() {
  const [dimensions, setDimensions] = useState(Dimensions.get("window"));

  const onChange = ({window}: {window: ScaledSize}) => {
    setDimensions(window);
  };

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", onChange);

    return () => {
      // @ts-expect-error - React Native >= 0.65
      if (typeof subscription?.remove === "function") {
        // @ts-expect-error
        subscription.remove();
      } else {
        // React Native < 0.65
        Dimensions.removeEventListener("change", onChange);
      }
    };
  }, [onChange]);

  return dimensions;
}

// ============================================================================
// Toast Options and Props
// ============================================================================

export interface ToastOptions {
  /**
   * Id is optional, you may provide an id only if you want to update toast later using toast.update()
   */
  id?: string;

  /**
   * Customize toast icon
   */
  icon?: JSX.Element;

  /**
   * Toast types, You can implement your custom types with JSX using renderType method on ToastContainer.
   */
  type?: "normal" | "success" | "danger" | "warning" | string;

  /**
   * In ms, How long toast will stay before it go away
   */
  duration?: number;

  /**
   * Customize when toast should be placed
   */
  placement?: "top" | "bottom" | "center";

  /**
   * Customize style of toast
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Customize style of toast text
   */
  textStyle?: StyleProp<TextStyle>;

  /**
   * Customize how fast toast will show and hide
   */
  animationDuration?: number;

  /**
   * Customize how toast is animated when added or removed
   */
  animationType?: "slide-in" | "zoom-in";

  /**
   * Customize success type icon
   */
  successIcon?: JSX.Element;

  /**
   * Customize danger type icon
   */
  dangerIcon?: JSX.Element;

  /**
   * Customize warning type icon
   */
  warningIcon?: JSX.Element;

  /**
   * Customize success type color. changes toast background color
   */
  successColor?: string;

  /**
   * Customize danger type color. changes toast background color
   */
  dangerColor?: string;

  /**
   * Customize warning type color. changes toast background color
   */
  warningColor?: string;

  /**
   * Customize normal type color. changes toast background color
   */
  normalColor?: string;

  /**
   * Register event for when toast is pressed. If you're using a custom toast you have to pass this to a Touchable.
   */
  onPress?(id: string): void;

  /**
   * Execute event after toast is closed
   */
  onClose?(): void;

  /**
   * Payload data for custom toasts. You can pass whatever you want
   */
  data?: any;

  swipeEnabled?: boolean;
}

export interface ToastProps extends ToastOptions {
  id: string;
  onDestroy(): void;
  message: string | JSX.Element;
  open: boolean;
  renderToast?(toast: ToastProps): JSX.Element;
  renderType?: {[type: string]: (toast: ToastProps) => JSX.Element};
  onHide(): void;
}

// ============================================================================
// Toast Component
// ============================================================================

const ToastItem: FC<ToastProps> = (props) => {
  let {
    id,
    onDestroy,
    icon,
    type = "normal",
    message,
    duration = 5000,
    style,
    textStyle,
    animationDuration = 250,
    animationType = "slide-in",
    successIcon,
    dangerIcon,
    warningIcon,
    successColor,
    dangerColor,
    warningColor,
    normalColor,
    placement,
    swipeEnabled,
    onPress,
  } = props;

  const containerRef = useRef<View>(null);
  const [animation] = useState(new Animated.Value(0));
  const panResponderRef = useRef<PanResponderInstance>();
  const panResponderAnimRef = useRef<Animated.ValueXY>();
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dims = useDimensions();

  const handleClose = () => {
    Animated.timing(animation, {
      duration: animationDuration,
      toValue: 0,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => onDestroy());
  };

  useEffect(() => {
    Animated.timing(animation, {
      duration: animationDuration,
      toValue: 1,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    if (duration !== 0 && typeof duration === "number") {
      closeTimeoutRef.current = setTimeout(() => {
        handleClose();
      }, duration);
    }

    return () => {
      closeTimeoutRef.current && clearTimeout(closeTimeoutRef.current);
    };
  }, [duration, animation, animationDuration, handleClose]);

  // Handles hide & hideAll
  useEffect(() => {
    if (!props.open) {
      // Unregister close timeout
      closeTimeoutRef.current && clearTimeout(closeTimeoutRef.current);

      // Close animation them remove from stack.
      handleClose();
    }
  }, [
    props.open, // Close animation them remove from stack.
    handleClose,
  ]);

  const panReleaseToLeft = (gestureState: PanResponderGestureState) => {
    Animated.timing(getPanResponderAnim(), {
      duration: 250,
      toValue: {x: (-dims.width / 10) * 9, y: gestureState.dy},
      useNativeDriver: Platform.OS !== "web",
    }).start(() => onDestroy());
  };

  const panReleaseToRight = (gestureState: PanResponderGestureState) => {
    Animated.timing(getPanResponderAnim(), {
      duration: 250,
      toValue: {x: (dims.width / 10) * 9, y: gestureState.dy},
      useNativeDriver: Platform.OS !== "web",
    }).start(() => onDestroy());
  };

  const getPanResponder = () => {
    if (panResponderRef.current) return panResponderRef.current;
    const swipeThreshold = Platform.OS === "android" ? 10 : 0;
    panResponderRef.current = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        //return true if user is swiping, return false if it's a single click
        return (
          Math.abs(gestureState.dx) > swipeThreshold || Math.abs(gestureState.dy) > swipeThreshold
        );
      },
      onPanResponderMove: (_, gestureState) => {
        getPanResponderAnim()?.setValue({
          x: gestureState.dx,
          y: gestureState.dy,
        });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          panReleaseToRight(gestureState);
        } else if (gestureState.dx < -50) {
          panReleaseToLeft(gestureState);
        } else {
          Animated.spring(getPanResponderAnim(), {
            toValue: {x: 0, y: 0},
            useNativeDriver: Platform.OS !== "web",
          }).start();
        }
      },
    });
    return panResponderRef.current;
  };

  const getPanResponderAnim = () => {
    if (panResponderAnimRef.current) return panResponderAnimRef.current;
    panResponderAnimRef.current = new Animated.ValueXY({x: 0, y: 0});
    return panResponderAnimRef.current;
  };

  if (icon === undefined) {
    switch (type) {
      case "success": {
        if (successIcon) {
          icon = successIcon;
        }
        break;
      }

      case "danger": {
        if (dangerIcon) {
          icon = dangerIcon;
        }
        break;
      }
      case "warning": {
        if (warningIcon) {
          icon = warningIcon;
        }
        break;
      }
    }
  }

  let backgroundColor = "";
  switch (type) {
    case "success":
      backgroundColor = successColor || "rgb(46, 125, 50)";
      break;
    case "danger":
      backgroundColor = dangerColor || "rgb(211, 47, 47)";
      break;
    case "warning":
      backgroundColor = warningColor || "rgb(237, 108, 2)";
      break;
    default:
      backgroundColor = normalColor || "#333";
  }

  const animationStyle: Animated.WithAnimatedObject<ViewStyle> = {
    opacity: animation,
    transform: [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: placement === "bottom" ? [20, 0] : [-20, 0], // 0 : 150, 0.5 : 75, 1 : 0
        }),
      },
    ],
  };

  if (swipeEnabled) {
    animationStyle.transform?.push(getPanResponderAnim().getTranslateTransform()[0]);
  }

  if (animationType === "zoom-in") {
    animationStyle.transform?.push({
      scale: animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.7, 1],
      }),
    });
  }

  return (
    <Animated.View
      pointerEvents={"box-none"}
      ref={containerRef}
      {...(swipeEnabled ? getPanResponder().panHandlers : null)}
      style={[toastStyles.container, animationStyle]}
    >
      {props.renderType?.[type] ? (
        props.renderType[type](props)
      ) : props.renderToast ? (
        props.renderToast(props)
      ) : (
        <TouchableWithoutFeedback disabled={!onPress} onPress={() => onPress?.(id)}>
          <View
            style={[
              toastStyles.toastContainer,
              {backgroundColor, maxWidth: (dims.width / 10) * 9},
              style,
            ]}
          >
            {icon ? <View style={toastStyles.iconContainer}>{icon}</View> : null}
            {React.isValidElement(message) ? (
              message
            ) : (
              <Text style={[toastStyles.message, textStyle]}>{message}</Text>
            )}
          </View>
        </TouchableWithoutFeedback>
      )}
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  container: {alignItems: "center", width: "100%"},
  iconContainer: {
    marginRight: 5,
  },
  message: {
    color: "#fff",
    fontWeight: "500",
  },
  toastContainer: {
    alignItems: "center",
    borderRadius: 5,
    flexDirection: "row",
    marginVertical: 5,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});

// ============================================================================
// Toast Container
// ============================================================================

const {height, width} = Dimensions.get("window");

export interface ToastContainerProps extends ToastOptions {
  renderToast?(toast: ToastProps): JSX.Element;
  renderType?: {[type: string]: (toast: ToastProps) => JSX.Element};
  offset?: number;
  offsetTop?: number;
  offsetBottom?: number;
  swipeEnabled?: boolean;
}

interface ToastContainerState {
  toasts: Array<ToastProps>;
}

class ToastContainer extends Component<ToastContainerProps, ToastContainerState> {
  constructor(props: ToastContainerProps) {
    super(props);
    this.state = {
      toasts: [],
    };
  }

  static defaultProps: ToastContainerProps = {
    offset: 10,
    placement: "bottom",
    swipeEnabled: true,
  };

  /**
   * Shows a new toast. Returns id
   */
  show = (message: string | JSX.Element, toastOptions?: ToastOptions) => {
    const id = toastOptions?.id || Math.random().toString();
    const onDestroy = () => {
      toastOptions?.onClose?.();
      this.setState({toasts: this.state.toasts.filter((t) => t.id !== id)});
    };

    requestAnimationFrame(() => {
      this.setState({
        toasts: [
          {
            id,
            message,
            onDestroy,
            onHide: () => this.hide(id),
            open: true,
            ...this.props,
            ...toastOptions,
          },
          ...this.state.toasts.filter((t) => t.open),
        ],
      });
    });

    return id;
  };

  /**
   * Updates a toast, To use this create you must pass an id to show method first, then pass it here to update the toast.
   */
  update = (id: string, message: string | JSX.Element, toastOptions?: ToastOptions) => {
    this.setState({
      toasts: this.state.toasts.map((toast) =>
        toast.id === id ? {...toast, message, ...toastOptions} : toast
      ),
    });
  };

  /**
   * Removes a toast from stack
   */
  hide = (id: string) => {
    this.setState({
      toasts: this.state.toasts.map((t) => (t.id === id ? {...t, open: false} : t)),
    });
  };

  /**
   * Removes all toasts in stack
   */
  hideAll = () => {
    this.setState({
      toasts: this.state.toasts.map((t) => ({...t, open: false})),
    });
  };

  /**
   * Check if a toast is currently open
   */
  isOpen = (id: string) => {
    return this.state.toasts.some((t) => t.id === id && t.open);
  };

  renderBottomToasts() {
    const {toasts} = this.state;
    const {offset, offsetBottom} = this.props;
    const style: ViewStyle = {
      bottom: offsetBottom || offset,
      flexDirection: "column",
      justifyContent: "flex-end",
      width: width,
    };
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : undefined}
        pointerEvents="box-none"
        style={[containerStyles.container, style]}
      >
        <SafeAreaView>
          {toasts
            .filter((t) => !t.placement || t.placement === "bottom")
            .map((toast) => (
              <ToastItem key={toast.id} {...toast} />
            ))}
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  renderTopToasts() {
    const {toasts} = this.state;
    const {offset, offsetTop} = this.props;
    const style: ViewStyle = {
      flexDirection: "column-reverse",
      justifyContent: "flex-start",
      top: offsetTop || offset,
      width: width,
    };
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : undefined}
        pointerEvents="box-none"
        style={[containerStyles.container, style]}
      >
        <SafeAreaView>
          {toasts
            .filter((t) => t.placement === "top")
            .map((toast) => (
              <ToastItem key={toast.id} {...toast} />
            ))}
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }

  renderCenterToasts() {
    const {toasts} = this.state;
    const {offset, offsetTop} = this.props;
    const style: ViewStyle = {
      flexDirection: "column-reverse",
      height: height,
      justifyContent: "center",
      top: offsetTop || offset,
      width: width,
    };

    const data = toasts.filter((t) => t.placement === "center");
    const foundToast = data.length > 0;

    if (!foundToast) return null;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : undefined}
        pointerEvents="box-none"
        style={[containerStyles.container, style]}
      >
        {toasts
          .filter((t) => t.placement === "center")
          .map((toast) => (
            <ToastItem key={toast.id} {...toast} />
          ))}
      </KeyboardAvoidingView>
    );
  }

  render() {
    return (
      <>
        {this.renderTopToasts()}
        {this.renderBottomToasts()}
        {this.renderCenterToasts()}
      </>
    );
  }
}

const containerStyles = StyleSheet.create({
  container: {
    alignSelf: "center",
    elevation: 999999,
    flex: 0,
    maxWidth: "100%",
    // @ts-expect-error: fixed is available on web.
    position: Platform.OS === "web" ? "fixed" : "absolute",
    zIndex: 999999,
    ...(Platform.OS === "web" ? {overflow: "hidden", userSelect: "none"} : null),
  },
  message: {
    color: "#333",
  },
});

// ============================================================================
// Toast Context and Hook
// ============================================================================

export type ToastType = Pick<ToastContainer, "show" | "update" | "hide" | "hideAll" | "isOpen">;

const ToastContext = createContext({} as ToastType);

export let GlobalToast: ToastType;

type ToastProviderProps = ToastContainerProps & {
  children: React.ReactNode;
};

export const ToastProvider: FC<ToastProviderProps> = ({children, ...props}) => {
  const toastRef = useRef(null);
  const [refState, setRefState] = useState({});

  useEffect(() => {
    setRefState(toastRef.current as any);
    GlobalToast = toastRef.current as any;
  }, []);

  return (
    <ToastContext.Provider value={refState as any}>
      {children}
      <ToastContainer ref={toastRef} {...props} />
    </ToastContext.Provider>
  );
};

export const useToastNotifications = (): ToastType => useContext(ToastContext);

export default ToastContainer;
