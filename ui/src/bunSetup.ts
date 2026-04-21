import {beforeEach, mock} from "bun:test";
import React from "react";

type MockComponentProps = Record<string, unknown> & {
  children?: React.ReactNode;
  style?: unknown;
  testID?: string;
};
type MockStyleValue = unknown;
type MockAnimation = {
  start?: (callback?: (result: {finished: boolean}) => void) => void;
  stop?: () => void;
  reset?: () => void;
};
type EasingFn = (t: number) => number;
type MockColor = string | number | null | undefined;
type MockAssetSource = {height?: number; uri?: string; width?: number} | null | undefined;

// Set environment variables
process.env.TZ = "America/New_York";
process.env.EXPO_OS = "ios";

// Define React Native globals
const rnGlobals = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __BUNDLE_START_TIME__?: number;
};
rnGlobals.__DEV__ = true;
rnGlobals.__BUNDLE_START_TIME__ = Date.now();

// Mock react-native to avoid Flow type errors
mock.module("react-native", () => {
  const View = ({children, style, testID, ...props}: MockComponentProps) =>
    React.createElement("View", {style, testID, ...props}, children);
  const Text = ({children, style, ...props}: MockComponentProps) =>
    React.createElement("Text", {style, ...props}, children);
  const TextInput = (props: MockComponentProps) => React.createElement("TextInput", props);
  const TouchableOpacity = ({children, ...props}: MockComponentProps) =>
    React.createElement("TouchableOpacity", props, children);
  const Pressable = ({children, ...props}: MockComponentProps) =>
    React.createElement("Pressable", props, children);
  const ScrollView = ({children, ...props}: MockComponentProps) =>
    React.createElement("ScrollView", props, children);
  const Image = (props: MockComponentProps) => React.createElement("Image", props);
  const ImageBackground = ({children, ...props}: MockComponentProps) =>
    React.createElement("ImageBackground", props, children);
  const ActivityIndicator = (props: MockComponentProps) =>
    React.createElement("ActivityIndicator", props);
  const FlatList = ({
    data,
    renderItem,
    keyExtractor,
    ...props
  }: MockComponentProps & {
    data?: unknown[];
    renderItem?: (info: {item: unknown; index: number; separators: unknown}) => React.ReactNode;
    keyExtractor?: (item: unknown, index: number) => string;
  }) =>
    React.createElement(
      "FlatList",
      props,
      data?.map((item: unknown, index: number) =>
        renderItem?.({index, item, separators: {highlight: () => {}, unhighlight: () => {}}})
      )
    );
  const SectionList = (props: MockComponentProps) => React.createElement("SectionList", props);
  const KeyboardAvoidingView = ({children, ...props}: MockComponentProps) =>
    React.createElement("KeyboardAvoidingView", props, children);
  const SafeAreaView = ({children, ...props}: MockComponentProps) =>
    React.createElement("SafeAreaView", props, children);
  const Modal = ({children, ...props}: MockComponentProps) =>
    React.createElement("Modal", props, children);
  const Switch = (props: MockComponentProps) => React.createElement("Switch", props);
  const AnimatedValue = class Value {
    _value: number;
    constructor(value: number = 0) {
      this._value = value;
    }
    setValue = mock((value: number) => {
      this._value = value;
    });
    setOffset = mock(() => {});
    flattenOffset = mock(() => {});
    extractOffset = mock(() => {});
    addListener = mock(() => "listener-id");
    removeListener = mock(() => {});
    removeAllListeners = mock(() => {});
    stopAnimation = mock((callback?: (value: number) => void) => callback?.(this._value));
    resetAnimation = mock((callback?: (value: number) => void) => callback?.(this._value));
    interpolate = mock(() => new AnimatedValue(0));
    animate = mock(() => {});
    stopTracking = mock(() => {});
    track = mock(() => {});
  };
  const AnimatedValueXY = class ValueXY {
    x: InstanceType<typeof AnimatedValue>;
    y: InstanceType<typeof AnimatedValue>;
    constructor(value?: {x?: number; y?: number}) {
      this.x = new AnimatedValue(value?.x || 0);
      this.y = new AnimatedValue(value?.y || 0);
    }
    setValue = mock(() => {});
    setOffset = mock(() => {});
    flattenOffset = mock(() => {});
    extractOffset = mock(() => {});
    stopAnimation = mock(() => {});
    resetAnimation = mock(() => {});
    addListener = mock(() => "listener-id");
    removeListener = mock(() => {});
    removeAllListeners = mock(() => {});
    getLayout = mock(() => ({left: this.x, top: this.y}));
    getTranslateTransform = mock(() => [{translateX: this.x}, {translateY: this.y}]);
  };
  const createAnimationMock = () => ({
    reset: mock(() => {}),
    start: mock((callback?: (result: {finished: boolean}) => void) => callback?.({finished: true})),
    stop: mock(() => {}),
  });
  const Animated = {
    // Operators
    add: mock(() => new AnimatedValue(0)),
    createAnimatedComponent: <T>(comp: T): T => comp,
    decay: mock(() => createAnimationMock()),
    delay: mock(() => createAnimationMock()),
    diffClamp: mock(() => new AnimatedValue(0)),
    divide: mock(() => new AnimatedValue(0)),
    // Event handling
    event: mock(() => mock(() => {})),
    FlatList,
    Image,
    loop: mock((animation: MockAnimation) => ({
      reset: mock(() => {}),
      start: mock((callback?: (result: {finished: boolean}) => void) => {
        animation?.start?.();
        callback?.({finished: true});
      }),
      stop: mock(() => {}),
    })),
    modulo: mock(() => new AnimatedValue(0)),
    multiply: mock(() => new AnimatedValue(0)),
    // Composition functions
    parallel: mock((animations: MockAnimation[]) => ({
      reset: mock(() => {}),
      start: mock((callback?: (result: {finished: boolean}) => void) => {
        animations?.forEach((anim: MockAnimation) => {
          anim?.start?.();
        });
        callback?.({finished: true});
      }),
      stop: mock(() => {}),
    })),
    ScrollView,
    sequence: mock((animations: MockAnimation[]) => ({
      reset: mock(() => {}),
      start: mock((callback?: (result: {finished: boolean}) => void) => {
        animations?.forEach((anim: MockAnimation) => {
          anim?.start?.();
        });
        callback?.({finished: true});
      }),
      stop: mock(() => {}),
    })),
    spring: mock(() => createAnimationMock()),
    stagger: mock((_delay: number, animations: MockAnimation[]) => ({
      reset: mock(() => {}),
      start: mock((callback?: (result: {finished: boolean}) => void) => {
        animations?.forEach((anim: MockAnimation) => {
          anim?.start?.();
        });
        callback?.({finished: true});
      }),
      stop: mock(() => {}),
    })),
    subtract: mock(() => new AnimatedValue(0)),
    Text,
    // Animation functions
    timing: mock(() => createAnimationMock()),
    Value: AnimatedValue,
    ValueXY: AnimatedValueXY,
    // Animated components
    View,
  };
  const StyleSheet = {
    absoluteFill: {bottom: 0, left: 0, position: "absolute", right: 0, top: 0},
    absoluteFillObject: {bottom: 0, left: 0, position: "absolute", right: 0, top: 0},
    create: <T>(styles: T): T => styles,
    flatten: (style: MockStyleValue) =>
      Array.isArray(style) ? Object.assign({}, ...style) : style || {},
    hairlineWidth: 1,
  };
  const Platform = {
    OS: "ios",
    select: <T>(obj: {ios?: T; default?: T}): T | undefined => obj.ios ?? obj.default,
    Version: "14.0",
  };
  const Dimensions = {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    get: mock(() => ({fontScale: 1, height: 812, scale: 2, width: 375})),
  };
  const useColorScheme = mock(() => "light");
  const useWindowDimensions = mock(() => ({fontScale: 1, height: 812, scale: 2, width: 375}));
  const Keyboard = {
    addListener: mock(() => ({remove: mock(() => {})})),
    dismiss: mock(() => {}),
  };
  const LayoutAnimation = {
    configureNext: mock(() => {}),
    create: mock(() => ({})),
    Presets: {},
    Properties: {},
    Types: {},
  };
  const Linking = {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    canOpenURL: mock(() => Promise.resolve(true)),
    getInitialURL: mock(() => Promise.resolve(null)),
    openURL: mock(() => Promise.resolve()),
  };
  const Alert = {
    alert: mock(() => {}),
  };
  const Appearance = {
    addChangeListener: mock(() => ({remove: mock(() => {})})),
    getColorScheme: mock(() => "light"),
  };
  const Vibration = {
    cancel: mock(() => {}),
    vibrate: mock(() => {}),
  };
  const NativeModules = {};
  const StatusBar = {
    setBackgroundColor: mock(() => {}),
    setBarStyle: mock(() => {}),
    setHidden: mock(() => {}),
    setNetworkActivityIndicatorVisible: mock(() => {}),
    setTranslucent: mock(() => {}),
  };
  const AccessibilityInfo = {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    announceForAccessibility: mock(() => {}),
    isAccessibilityServiceEnabled: mock(() => Promise.resolve(false)),
    isBoldTextEnabled: mock(() => Promise.resolve(false)),
    isGrayscaleEnabled: mock(() => Promise.resolve(false)),
    isInvertColorsEnabled: mock(() => Promise.resolve(false)),
    isReduceMotionEnabled: mock(() => Promise.resolve(false)),
    isReduceTransparencyEnabled: mock(() => Promise.resolve(false)),
    isScreenReaderEnabled: mock(() => Promise.resolve(false)),
    setAccessibilityFocus: mock(() => {}),
  };
  const Share = {
    dismiss: mock(() => Promise.resolve()),
    share: mock(() => Promise.resolve({action: "sharedAction"})),
  };
  const PixelRatio = {
    get: mock(() => 2),
    getFontScale: mock(() => 1),
    getPixelSizeForLayoutSize: mock((size: number) => size * 2),
    roundToNearestPixel: mock((size: number) => size),
  };
  const I18nManager = {
    allowRTL: mock(() => {}),
    doLeftAndRightSwapInRTL: true,
    forceRTL: mock(() => {}),
    isRTL: false,
    swapLeftAndRightInRTL: mock(() => {}),
  };
  const BackHandler = {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    exitApp: mock(() => {}),
  };
  const TouchableWithoutFeedback = ({children, ...props}: MockComponentProps) =>
    React.createElement("TouchableWithoutFeedback", props, children);
  const TouchableHighlight = ({children, ...props}: MockComponentProps) =>
    React.createElement("TouchableHighlight", props, children);
  const TouchableNativeFeedback = ({children, ...props}: MockComponentProps) =>
    React.createElement("TouchableNativeFeedback", props, children);
  const Touchable = {
    Mixin: {
      touchableGetInitialState: () => ({}),
      touchableHandleResponderGrant: mock(() => {}),
      touchableHandleResponderMove: mock(() => {}),
      touchableHandleResponderRelease: mock(() => {}),
      touchableHandleResponderTerminate: mock(() => {}),
      touchableHandleResponderTerminationRequest: () => true,
      touchableHandleStartShouldSetResponder: () => true,
    },
    renderDebugView: mock(() => null),
    TOUCH_TARGET_DEBUG: false,
  };
  const processColor = (color: string | number | null | undefined) => {
    if (color === null || color === undefined) {
      return null;
    }
    if (typeof color === "number") {
      return color;
    }
    // Return a mock color number
    return 0xff000000;
  };
  const UIManager = {
    getViewManagerConfig: mock(() => ({})),
    setLayoutAnimationEnabledExperimental: mock(() => {}),
  };
  const findNodeHandle = mock(() => null);
  const requireNativeComponent = mock((name: string) => name);
  const TurboModuleRegistry = {
    get: mock(() => null),
    getEnforcing: mock(() => ({})),
  };
  const PanResponder = {
    create: mock(() => ({
      getInteractionHandle: mock(() => null),
      panHandlers: {
        onMoveShouldSetResponder: mock(() => false),
        onMoveShouldSetResponderCapture: mock(() => false),
        onResponderEnd: mock(() => {}),
        onResponderGrant: mock(() => {}),
        onResponderMove: mock(() => {}),
        onResponderReject: mock(() => {}),
        onResponderRelease: mock(() => {}),
        onResponderStart: mock(() => {}),
        onResponderTerminate: mock(() => {}),
        onResponderTerminationRequest: mock(() => true),
        onStartShouldSetResponder: mock(() => false),
        onStartShouldSetResponderCapture: mock(() => false),
      },
    })),
  };
  const Easing = {
    back: mock(() => (t: number) => t),
    bezier: mock(() => (t: number) => t),
    bounce: mock((t: number) => t),
    circle: mock((t: number) => t),
    cubic: mock((t: number) => t * t * t),
    ease: mock((t: number) => t),
    elastic: mock(() => (t: number) => t),
    exp: mock((t: number) => t),
    in: mock((f: EasingFn) => f),
    inOut: mock((f: EasingFn) => f),
    linear: mock((t: number) => t),
    out: mock((f: EasingFn) => f),
    poly: mock(() => (t: number) => t),
    quad: mock((t: number) => t * t),
    sin: mock((t: number) => Math.sin(t)),
  };
  const NativeEventEmitter = class {
    addListener = mock(() => ({remove: mock(() => {})}));
    removeAllListeners = mock(() => {});
    removeSubscription = mock(() => {});
  };

  return {
    AccessibilityInfo,
    ActivityIndicator,
    Alert,
    Animated,
    Appearance,
    BackHandler,
    Dimensions,
    default: {
      AccessibilityInfo,
      ActivityIndicator,
      Alert,
      Animated,
      Appearance,
      BackHandler,
      Dimensions,
      Easing,
      FlatList,
      findNodeHandle,
      I18nManager,
      Image,
      ImageBackground,
      Keyboard,
      KeyboardAvoidingView,
      LayoutAnimation,
      Linking,
      Modal,
      NativeEventEmitter,
      NativeModules,
      PanResponder,
      PixelRatio,
      Platform,
      Pressable,
      processColor,
      requireNativeComponent,
      SafeAreaView,
      ScrollView,
      SectionList,
      Share,
      StatusBar,
      StyleSheet,
      Switch,
      Text,
      TextInput,
      Touchable,
      TouchableHighlight,
      TouchableNativeFeedback,
      TouchableOpacity,
      TouchableWithoutFeedback,
      TurboModuleRegistry,
      UIManager,
      useColorScheme,
      useWindowDimensions,
      Vibration,
      View,
    },
    Easing,
    FlatList,
    findNodeHandle,
    I18nManager,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    LayoutAnimation,
    Linking,
    Modal,
    NativeEventEmitter,
    NativeModules,
    PanResponder,
    PixelRatio,
    Platform,
    Pressable,
    processColor,
    requireNativeComponent,
    SafeAreaView,
    ScrollView,
    SectionList,
    Share,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    Touchable,
    TouchableHighlight,
    TouchableNativeFeedback,
    TouchableOpacity,
    TouchableWithoutFeedback,
    TurboModuleRegistry,
    UIManager,
    useColorScheme,
    useWindowDimensions,
    Vibration,
    View,
  };
});

// Initialize globalThis.expo early for expo-modules-core
if (typeof globalThis.expo === "undefined") {
  const EventEmitterClass = class EventEmitter {
    addListener = mock(() => {});
    removeListener = mock(() => {});
    removeAllListeners = mock(() => {});
    emit = mock(() => {});
  };

  globalThis.expo = {
    EventEmitter: EventEmitterClass,
    NativeModule: class NativeModule {},
    SharedObject: class SharedObject {},
    // noExplicitAny: globalThis.expo is typed by expo-modules-core with many native-only APIs
    // that aren't needed for these mocks, so we cast through unknown to satisfy the type.
  } as unknown as typeof globalThis.expo;
}

// Mock expo-router
mock.module("expo-router", () => ({
  Link: ({children, ...props}: MockComponentProps) => React.createElement("Link", props, children),
  Navigator: ({children, ...props}: MockComponentProps) =>
    React.createElement("Navigator", props, children),
  router: {
    back: mock(() => {}),
    canGoBack: mock(() => true),
    navigate: mock(() => {}),
    push: mock(() => {}),
    replace: mock(() => {}),
  },
  Slot: ({children, ...props}: MockComponentProps) => React.createElement("Slot", props, children),
  Stack: ({children, ...props}: MockComponentProps) =>
    React.createElement("Stack", props, children),
  Tabs: ({children, ...props}: MockComponentProps) => React.createElement("Tabs", props, children),
  useFocusEffect: mock(() => undefined),
  useLocalSearchParams: mock(() => ({})),
  useNavigation: mock(() => ({
    addListener: mock(() => () => undefined),
    goBack: mock(() => {}),
    navigate: mock(() => {}),
    setOptions: mock(() => {}),
  })),
  usePathname: mock(() => "/"),
  useRouter: mock(() => ({
    back: mock(() => {}),
    canGoBack: mock(() => true),
    navigate: mock(() => {}),
    push: mock(() => {}),
    replace: mock(() => {}),
  })),
  useSearchParams: mock(() => ({})),
  useSegments: mock(() => []),
}));

// Mock @react-native-async-storage/async-storage
mock.module("@react-native-async-storage/async-storage", () => ({
  clear: mock(() => Promise.resolve()),
  default: {
    clear: mock(() => Promise.resolve()),
    getAllKeys: mock(() => Promise.resolve([])),
    getItem: mock(() => Promise.resolve(null)),
    mergeItem: mock(() => Promise.resolve()),
    multiGet: mock(() => Promise.resolve([])),
    multiRemove: mock(() => Promise.resolve()),
    multiSet: mock(() => Promise.resolve()),
    removeItem: mock(() => Promise.resolve()),
    setItem: mock(() => Promise.resolve()),
  },
  getAllKeys: mock(() => Promise.resolve([])),
  getItem: mock(() => Promise.resolve(null)),
  mergeItem: mock(() => Promise.resolve()),
  multiGet: mock(() => Promise.resolve([])),
  multiRemove: mock(() => Promise.resolve()),
  multiSet: mock(() => Promise.resolve()),
  removeItem: mock(() => Promise.resolve()),
  setItem: mock(() => Promise.resolve()),
}));

// Mock react-native-signature-canvas
mock.module("react-native-signature-canvas", () => ({
  Signature: mock(() => null),
}));

// Mock IconButton component
mock.module("./IconButton", () => ({
  IconButton: mock(() => null),
}));

// Mock expo-font
mock.module("expo-font", () => ({
  isLoaded: mock(() => true),
  loadAsync: mock(() => Promise.resolve()),
  loadNativeFonts: mock(() => Promise.resolve()),
  useFonts: mock(() => [true, null]),
}));

// Mock Google fonts packages
mock.module("@expo-google-fonts/nunito", () => ({
  Nunito_200ExtraLight: "Nunito_200ExtraLight",
  Nunito_200ExtraLight_Italic: "Nunito_200ExtraLight_Italic",
  Nunito_300Light: "Nunito_300Light",
  Nunito_300Light_Italic: "Nunito_300Light_Italic",
  Nunito_400Regular: "Nunito_400Regular",
  Nunito_400Regular_Italic: "Nunito_400Regular_Italic",
  Nunito_500Medium: "Nunito_500Medium",
  Nunito_500Medium_Italic: "Nunito_500Medium_Italic",
  Nunito_600SemiBold: "Nunito_600SemiBold",
  Nunito_600SemiBold_Italic: "Nunito_600SemiBold_Italic",
  Nunito_700Bold: "Nunito_700Bold",
  Nunito_700Bold_Italic: "Nunito_700Bold_Italic",
  Nunito_800ExtraBold: "Nunito_800ExtraBold",
  Nunito_800ExtraBold_Italic: "Nunito_800ExtraBold_Italic",
  Nunito_900Black: "Nunito_900Black",
  Nunito_900Black_Italic: "Nunito_900Black_Italic",
  useFonts: mock(() => [true, null]),
}));

mock.module("@expo-google-fonts/titillium-web", () => ({
  TitilliumWeb_200ExtraLight: "TitilliumWeb_200ExtraLight",
  TitilliumWeb_200ExtraLight_Italic: "TitilliumWeb_200ExtraLight_Italic",
  TitilliumWeb_300Light: "TitilliumWeb_300Light",
  TitilliumWeb_300Light_Italic: "TitilliumWeb_300Light_Italic",
  TitilliumWeb_400Regular: "TitilliumWeb_400Regular",
  TitilliumWeb_400Regular_Italic: "TitilliumWeb_400Regular_Italic",
  TitilliumWeb_600SemiBold: "TitilliumWeb_600SemiBold",
  TitilliumWeb_600SemiBold_Italic: "TitilliumWeb_600SemiBold_Italic",
  TitilliumWeb_700Bold: "TitilliumWeb_700Bold",
  TitilliumWeb_700Bold_Italic: "TitilliumWeb_700Bold_Italic",
  TitilliumWeb_900Black: "TitilliumWeb_900Black",
  useFonts: mock(() => [true, null]),
}));

// Mock DateTimeActionSheet
mock.module("./DateTimeActionSheet", () => ({
  DateTimeActionSheet: mock(() => null),
}));

// Mock MediaQuery
mock.module("./MediaQuery", () => ({
  isMobileDevice: mock(() => false),
  mediaQueryLargerThan: mock(() => false),
}));

// Mock expo-image-manipulator
mock.module("expo-image-manipulator", () => ({
  ImageManipulator: {
    manipulateAsync: mock(() => {}),
  },
  SaveFormat: {
    JPEG: "jpeg",
    PNG: "png",
  },
}));

// Mock expo-image-picker
mock.module("expo-image-picker", () => ({
  launchImageLibraryAsync: mock(() => {}),
  MediaTypeOptions: {
    Images: "images",
  },
  requestMediaLibraryPermissionsAsync: mock(() => {}),
}));

// Mock expo-haptics
mock.module("expo-haptics", () => ({
  ImpactFeedbackStyle: {
    Heavy: "heavy",
    Light: "light",
    Medium: "medium",
  },
  impactAsync: mock(() => {}),
  NotificationFeedbackType: {
    Error: "error",
    Success: "success",
    Warning: "warning",
  },
  notificationAsync: mock(() => {}),
  selectionAsync: mock(() => {}),
}));

// Mock expo-clipboard
mock.module("expo-clipboard", () => ({
  getStringAsync: mock(() => Promise.resolve("")),
  hasStringAsync: mock(() => Promise.resolve(false)),
  setStringAsync: mock(() => Promise.resolve(undefined)),
}));

// Mock expo-localization
mock.module("expo-localization", () => ({
  getCalendars: mock(() => [
    {
      calendar: "gregorian",
      id: "gregorian",
      locale: "en-US",
      timeZone: "America/New_York",
    },
  ]),
  getLocales: mock(() => [
    {
      countryCode: "US",
      decimalSeparator: ".",
      digitGroupingSeparator: ",",
      languageCode: "en",
      measurementSystem: "US",
      temperatureUnit: "F",
      textDirection: "ltr",
      uses24hourClock: false,
      usesMetricSystem: false,
    },
  ]),
  isRTL: false,
  locale: "en-US",
  locales: ["en-US"],
  timezone: "America/New_York",
}));

// Mock @expo/vector-icons
mock.module("@expo/vector-icons", () => ({
  default: mock(() => null),
  FontAwesome6: mock(() => null),
}));

// Mock @expo/vector-icons/FontAwesome6
mock.module("@expo/vector-icons/FontAwesome6", () => ({
  default: mock(() => null),
}));

// Mock linkify-it - need to mock the Hyperlink component directly instead
mock.module("./Hyperlink", () => ({
  Hyperlink: ({children}: MockComponentProps) => React.createElement("View", {}, children),
}));

// Mock react-native internal modules with Flow types
// These modules use Flow type syntax that Bun cannot parse

// StyleSheet related
mock.module("react-native/Libraries/StyleSheet/processColor", () => {
  const processColor = (color: MockColor) => {
    if (color === null || color === undefined) return null;
    if (typeof color === "number") return color;
    return 0xff000000;
  };
  return {__esModule: true, default: processColor};
});

mock.module("react-native/Libraries/StyleSheet/normalizeColor", () => {
  const normalizeColor = (color: MockColor) => {
    if (color === null || color === undefined) return null;
    if (typeof color === "number") return color;
    return 0xff000000;
  };
  return {__esModule: true, default: normalizeColor};
});

mock.module("react-native/Libraries/StyleSheet/PlatformColorValueTypes", () => ({
  DynamicColorIOS: (obj: {light: unknown}) => obj.light,
  normalizeColorObject: (color: MockColor) => color,
  PlatformColor: (...args: unknown[]) => args[0],
  processColorObject: (color: MockColor) => color,
}));

mock.module("react-native/Libraries/StyleSheet/StyleSheet", () => ({
  absoluteFill: {bottom: 0, left: 0, position: "absolute", right: 0, top: 0},
  absoluteFillObject: {bottom: 0, left: 0, position: "absolute", right: 0, top: 0},
  create: <T>(styles: T): T => styles,
  default: {
    absoluteFill: {bottom: 0, left: 0, position: "absolute", right: 0, top: 0},
    absoluteFillObject: {bottom: 0, left: 0, position: "absolute", right: 0, top: 0},
    create: <T>(styles: T): T => styles,
    flatten: (style: MockStyleValue) =>
      Array.isArray(style) ? Object.assign({}, ...style) : style || {},
    hairlineWidth: 1,
  },
  flatten: (style: MockStyleValue) =>
    Array.isArray(style) ? Object.assign({}, ...style) : style || {},
  hairlineWidth: 1,
}));

// NativeComponent related
mock.module("react-native/Libraries/NativeComponent/NativeComponentRegistry", () => ({
  get: mock(() => "View"),
  getWithFallback_DEPRECATED: mock(() => "View"),
  setRuntimeConfigProvider: mock(() => {}),
}));

mock.module("react-native/Libraries/NativeComponent/ViewConfigIgnore", () => ({
  ConditionallyIgnoredEventHandlers: <T>(handlers: T): T => handlers,
  DifferentHeuristics: {},
  ignoredViewConfigPropNames: new Set(),
  isIgnoredViewConfigProp: mock(() => false),
}));

// Mock @react-native-community/slider
mock.module("@react-native-community/slider", () => ({
  default: (props: MockComponentProps) => React.createElement("Slider", props),
  Slider: (props: MockComponentProps) => React.createElement("Slider", props),
}));

// Mock react-native-swiper-flatlist
mock.module("react-native-swiper-flatlist", () => ({
  default: ({children, ...props}: MockComponentProps) =>
    React.createElement("SwiperFlatList", props, children),
  SwiperFlatList: ({children, ...props}: MockComponentProps) =>
    React.createElement("SwiperFlatList", props, children),
}));

// Mock Unifier module
mock.module("./Unifier", () => ({
  changeColorLuminance: mock((hex: string, _luminanceChange: string) => hex),
  Unifier: {
    dev: false,
    initIcons: mock(() => {}),
    navigation: {
      dismissOverlay: mock(() => {}),
    },
    storage: {
      getItem: mock(() => Promise.resolve(null)),
      setItem: mock(() => Promise.resolve()),
    },
    tracking: {
      log: mock(() => {}),
    },
    utils: {
      copyToClipboard: mock(() => {}),
      dimensions: mock(() => ({height: 812, width: 375})),
      dismissKeyboard: mock(() => {}),
      haptic: mock(() => Promise.resolve()),
      makePurchase: mock(() => {}),
      openUrl: mock(() => Promise.resolve()),
      orientationChange: mock(() => {}),
      PaymentService: mock(() => {}),
      requestPermissions: mock(() => Promise.resolve(true)),
      vibrate: mock(() => {}),
    },
    web: false,
  },
}));

mock.module("react-native/Libraries/Utilities/codegenNativeComponent", () => ({
  default: mock((name: string) => name),
}));

mock.module("react-native/Libraries/Utilities/codegenNativeCommands", () => ({
  default: mock(() => ({})),
}));

// Image related
mock.module("react-native/Libraries/Image/resolveAssetSource", () => {
  const resolveAssetSource = (source: MockAssetSource) => ({
    height: source?.height || 0,
    scale: 1,
    uri: source?.uri || "",
    width: source?.width || 0,
  });
  return {__esModule: true, default: resolveAssetSource};
});

mock.module("react-native/Libraries/Image/AssetSourceResolver", () => ({
  default: class AssetSourceResolver {
    defaultAsset = () => ({height: 0, scale: 1, uri: "", width: 0});
    fromSource = () => ({height: 0, scale: 1, uri: "", width: 0});
  },
}));

mock.module("react-native/Libraries/Image/ImageSource", () => ({
  default: {},
}));

// Animated related
mock.module("react-native/Libraries/Animated/Animated", () => {
  const View = ({children, style}: MockComponentProps) =>
    React.createElement("View", {style}, children);
  const Text = ({children, style}: MockComponentProps) =>
    React.createElement("Text", {style}, children);
  const Image = (props: MockComponentProps) => React.createElement("Image", props);
  const ScrollView = ({children}: MockComponentProps) =>
    React.createElement("ScrollView", {}, children);
  return {
    createAnimatedComponent: <T>(c: T): T => c,
    default: {
      createAnimatedComponent: <T>(c: T): T => c,
      Image,
      ScrollView,
      Text,
      View,
    },
    Image,
    ScrollView,
    Text,
    View,
  };
});

mock.module("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({
  default: {},
  shouldUseNativeDriver: () => false,
}));

// Event related
mock.module("react-native/Libraries/EventEmitter/NativeEventEmitter", () => ({
  default: class NativeEventEmitter {
    addListener = mock(() => ({remove: mock(() => {})}));
    removeAllListeners = mock(() => {});
  },
}));

// TurboModule related
mock.module("react-native/Libraries/TurboModule/TurboModuleRegistry", () => ({
  get: mock(() => null),
  getEnforcing: mock(() => ({})),
}));

// Utilities
mock.module("react-native/Libraries/Utilities/Platform", () => ({
  default: {
    OS: "ios",
    select: <T>(obj: {ios?: T; default?: T}): T | undefined => obj.ios ?? obj.default,
    Version: "14.0",
  },
  OS: "ios",
  select: <T>(obj: {ios?: T; default?: T}): T | undefined => obj.ios ?? obj.default,
  Version: "14.0",
}));

mock.module("react-native/Libraries/Utilities/Dimensions", () => ({
  addEventListener: () => ({remove: () => {}}),
  default: {
    addEventListener: () => ({remove: () => {}}),
    get: () => ({fontScale: 1, height: 812, scale: 2, width: 375}),
  },
  get: () => ({fontScale: 1, height: 812, scale: 2, width: 375}),
}));

mock.module("react-native/Libraries/Utilities/PixelRatio", () => ({
  default: {
    get: () => 2,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: (size: number) => size * 2,
    roundToNearestPixel: (size: number) => size,
  },
}));

mock.module("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  default: () => ({fontScale: 1, height: 812, scale: 2, width: 375}),
}));

mock.module("react-native/Libraries/Utilities/useColorScheme", () => ({
  default: () => "light",
}));

// Components
mock.module("react-native/Libraries/Components/View/View", () => ({
  default: ({children, style, testID, ...props}: MockComponentProps) =>
    React.createElement("View", {style, testID, ...props}, children),
}));

mock.module("react-native/Libraries/Text/Text", () => ({
  default: ({children, style, ...props}: MockComponentProps) =>
    React.createElement("Text", {style, ...props}, children),
}));

mock.module("react-native/Libraries/Components/TextInput/TextInput", () => ({
  default: (props: MockComponentProps) => React.createElement("TextInput", props),
}));

mock.module("react-native/Libraries/Image/Image", () => ({
  default: (props: MockComponentProps) => React.createElement("Image", props),
}));

mock.module("react-native/Libraries/Components/ScrollView/ScrollView", () => ({
  default: ({children, ...props}: MockComponentProps) =>
    React.createElement("ScrollView", props, children),
}));

mock.module("react-native/Libraries/Components/Pressable/Pressable", () => ({
  default: ({children, ...props}: MockComponentProps) =>
    React.createElement("Pressable", props, children),
}));

mock.module("react-native/Libraries/Components/Touchable/TouchableOpacity", () => ({
  default: ({children, ...props}: MockComponentProps) =>
    React.createElement("TouchableOpacity", props, children),
}));

mock.module("react-native/Libraries/Components/ActivityIndicator/ActivityIndicator", () => ({
  default: (props: MockComponentProps) => React.createElement("ActivityIndicator", props),
}));

mock.module("react-native/Libraries/Modal/Modal", () => ({
  default: ({children, ...props}: MockComponentProps) =>
    React.createElement("Modal", props, children),
}));

mock.module("react-native/Libraries/Components/Switch/Switch", () => ({
  default: (props: MockComponentProps) => React.createElement("Switch", props),
}));

mock.module("react-native/Libraries/Lists/FlatList", () => ({
  default: ({
    data,
    renderItem,
    ...props
  }: MockComponentProps & {
    data?: unknown[];
    renderItem?: (info: {item: unknown; index: number; separators: unknown}) => React.ReactNode;
  }) =>
    React.createElement(
      "FlatList",
      props,
      data?.map((item: unknown, index: number) =>
        renderItem?.({index, item, separators: {highlight: () => {}, unhighlight: () => {}}})
      )
    ),
}));

mock.module("react-native/Libraries/Lists/SectionList", () => ({
  default: (props: MockComponentProps) => React.createElement("SectionList", props),
}));

// APIs
mock.module("react-native/Libraries/Alert/Alert", () => ({
  default: {alert: mock(() => {})},
}));

mock.module("react-native/Libraries/Linking/Linking", () => ({
  default: {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    canOpenURL: mock(() => Promise.resolve(true)),
    getInitialURL: mock(() => Promise.resolve(null)),
    openURL: mock(() => Promise.resolve()),
  },
}));

mock.module("react-native/Libraries/Share/Share", () => ({
  default: {
    dismiss: mock(() => Promise.resolve()),
    share: mock(() => Promise.resolve({action: "sharedAction"})),
  },
}));

mock.module("react-native/Libraries/Vibration/Vibration", () => ({
  default: {
    cancel: mock(() => {}),
    vibrate: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/Components/Keyboard/Keyboard", () => ({
  default: {
    addListener: mock(() => ({remove: mock(() => {})})),
    dismiss: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/AppState/AppState", () => ({
  default: {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    currentState: "active",
  },
}));

mock.module("react-native/Libraries/Interaction/PanResponder", () => ({
  default: {
    create: mock(() => ({
      getInteractionHandle: mock(() => null),
      panHandlers: {},
    })),
  },
}));

mock.module("react-native/Libraries/LayoutAnimation/LayoutAnimation", () => ({
  default: {
    configureNext: mock(() => {}),
    create: mock(() => ({})),
    Presets: {},
    Properties: {},
    Types: {},
  },
}));

mock.module("react-native/Libraries/ReactNative/UIManager", () => ({
  default: {
    getViewManagerConfig: mock(() => ({})),
    setLayoutAnimationEnabledExperimental: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/Renderer/shims/ReactNative", () => ({
  findNodeHandle: mock(() => null),
}));

mock.module("react-native/Libraries/Components/StatusBar/StatusBar", () => ({
  default: {
    setBackgroundColor: mock(() => {}),
    setBarStyle: mock(() => {}),
    setHidden: mock(() => {}),
    setNetworkActivityIndicatorVisible: mock(() => {}),
    setTranslucent: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo", () => ({
  default: {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    announceForAccessibility: mock(() => {}),
    isAccessibilityServiceEnabled: mock(() => Promise.resolve(false)),
    isBoldTextEnabled: mock(() => Promise.resolve(false)),
    isGrayscaleEnabled: mock(() => Promise.resolve(false)),
    isInvertColorsEnabled: mock(() => Promise.resolve(false)),
    isReduceMotionEnabled: mock(() => Promise.resolve(false)),
    isReduceTransparencyEnabled: mock(() => Promise.resolve(false)),
    isScreenReaderEnabled: mock(() => Promise.resolve(false)),
    setAccessibilityFocus: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/Utilities/BackHandler", () => ({
  default: {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    exitApp: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/Utilities/Appearance", () => ({
  default: {
    addChangeListener: mock(() => ({remove: mock(() => {})})),
    getColorScheme: mock(() => "light"),
  },
}));

mock.module("react-native/Libraries/ReactNative/I18nManager", () => ({
  default: {
    allowRTL: mock(() => {}),
    doLeftAndRightSwapInRTL: true,
    forceRTL: mock(() => {}),
    isRTL: false,
    swapLeftAndRightInRTL: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/BatchedBridge/NativeModules", () => ({
  default: {},
}));

mock.module("react-native/Libraries/Animated/Easing", () => ({
  default: {
    back: () => (t: number) => t,
    bezier: () => (t: number) => t,
    bounce: (t: number) => t,
    circle: (t: number) => t,
    cubic: (t: number) => t * t * t,
    ease: (t: number) => t,
    elastic: () => (t: number) => t,
    exp: (t: number) => t,
    in: (f: EasingFn) => f,
    inOut: (f: EasingFn) => f,
    linear: (t: number) => t,
    out: (f: EasingFn) => f,
    poly: () => (t: number) => t,
    quad: (t: number) => t * t,
    sin: (t: number) => Math.sin(t),
  },
}));

mock.module("react-native/Libraries/Components/Touchable/Touchable", () => ({
  default: {
    Mixin: {
      touchableGetInitialState: () => ({}),
      touchableHandleResponderGrant: mock(() => {}),
      touchableHandleResponderMove: mock(() => {}),
      touchableHandleResponderRelease: mock(() => {}),
      touchableHandleResponderTerminate: mock(() => {}),
      touchableHandleResponderTerminationRequest: () => true,
      touchableHandleStartShouldSetResponder: () => true,
    },
    renderDebugView: mock(() => null),
    TOUCH_TARGET_DEBUG: false,
  },
  Mixin: {
    touchableGetInitialState: () => ({}),
    touchableHandleResponderGrant: mock(() => {}),
    touchableHandleResponderMove: mock(() => {}),
    touchableHandleResponderRelease: mock(() => {}),
    touchableHandleResponderTerminate: mock(() => {}),
    touchableHandleResponderTerminationRequest: () => true,
    touchableHandleStartShouldSetResponder: () => true,
  },
}));

// Additional internal modules
mock.module("react-native/Libraries/vendor/core/ErrorUtils", () => ({
  default: {
    getGlobalHandler: mock(() => () => {}),
    setGlobalHandler: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/Core/ReactNativeVersion", () => ({
  version: {major: 0, minor: 81, patch: 5},
}));

mock.module("react-native/Libraries/Core/NativeExceptionsManager", () => ({
  default: null,
}));

mock.module("react-native/Libraries/NativeModules/specs/NativeDevSettings", () => ({
  default: null,
}));

mock.module("react-native/Libraries/Core/Devtools/parseErrorStack", () => ({
  default: mock(() => []),
}));

mock.module("react-native/Libraries/LogBox/LogBox", () => ({
  default: {
    ignoreAllLogs: mock(() => {}),
    ignoreLogs: mock(() => {}),
    install: mock(() => {}),
    uninstall: mock(() => {}),
  },
}));

// Mock @react-native-picker/picker
type PickerItem = (p: MockComponentProps) => React.ReactElement;
const PickerComponent = ({children, ...props}: MockComponentProps) =>
  React.createElement("Picker", props, children);
(PickerComponent as typeof PickerComponent & {Item: PickerItem}).Item = ({
  children,
  ...props
}: MockComponentProps) => React.createElement("Picker.Item", props, children);
mock.module("@react-native-picker/picker", () => ({
  Picker: PickerComponent,
  PickerIOS: PickerComponent,
}));

// Mock react-native-picker-select
mock.module("react-native-picker-select", () => ({
  default: ({children, ...props}: MockComponentProps) =>
    React.createElement("RNPickerSelect", props, children),
}));

// Mock @react-native-community/datetimepicker
mock.module("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: {
    dismiss: mock(() => Promise.resolve()),
    open: mock(() => Promise.resolve({action: "dismissed"})),
  },
  default: (props: MockComponentProps) => React.createElement("DateTimePicker", props),
}));

// Mock react-native-calendars
mock.module("react-native-calendars", () => ({
  Agenda: (props: MockComponentProps) => React.createElement("Agenda", props),
  AgendaList: (props: MockComponentProps) => React.createElement("AgendaList", props),
  Calendar: (props: MockComponentProps) => React.createElement("Calendar", props),
  CalendarList: (props: MockComponentProps) => React.createElement("CalendarList", props),
  ExpandableCalendar: (props: MockComponentProps) =>
    React.createElement("ExpandableCalendar", props),
  LocaleConfig: {
    defaultLocale: "en",
    locales: {},
  },
  WeekCalendar: (props: MockComponentProps) => React.createElement("WeekCalendar", props),
}));

// Mock more react-native internal modules with Flow types
mock.module("react-native/Libraries/Image/resolveAssetSource", () => ({
  default: mock((source: MockAssetSource) => ({
    height: source?.height || 0,
    scale: 1,
    uri: source?.uri || "",
    width: source?.width || 0,
  })),
}));

mock.module("react-native/Libraries/Image/AssetSourceResolver", () => ({
  default: class AssetSourceResolver {
    defaultAsset = mock(() => ({height: 0, scale: 1, uri: "", width: 0}));
    fromSource = mock(() => ({height: 0, scale: 1, uri: "", width: 0}));
  },
}));

// Mock react-native-gesture-handler
mock.module("react-native-gesture-handler", () => {
  const GestureHandler = ({children}: MockComponentProps) => children;

  type ChainableGesture = {
    [method: string]: (...args: unknown[]) => ChainableGesture;
  };
  // Create a chainable gesture object that returns itself for all method calls
  const createChainableGesture = (): ChainableGesture => {
    const gesture = {} as ChainableGesture;
    const chainableMethods = [
      "onBegin",
      "onStart",
      "onEnd",
      "onUpdate",
      "onChange",
      "onFinalize",
      "onTouchesDown",
      "onTouchesMove",
      "onTouchesUp",
      "onTouchesCancelled",
      "enabled",
      "shouldCancelWhenOutside",
      "hitSlop",
      "simultaneousWithExternalGesture",
      "requireExternalGestureToFail",
      "blocksExternalGesture",
      "withTestId",
      "minPointers",
      "maxPointers",
      "minDistance",
      "minVelocity",
      "minVelocityX",
      "minVelocityY",
      "activeOffsetX",
      "activeOffsetY",
      "failOffsetX",
      "failOffsetY",
      "averageTouches",
      "enableTrackpadTwoFingerGesture",
      "numberOfTaps",
      "maxDuration",
      "maxDelay",
      "maxDist",
      "minDuration",
      "numberOfPointers",
      "direction",
      "minScale",
      "minRotation",
      "runOnJS",
    ];
    chainableMethods.forEach((method) => {
      gesture[method] = mock(() => gesture);
    });
    return gesture;
  };

  return {
    BaseButton: GestureHandler,
    BorderlessButton: GestureHandler,
    createNativeWrapper: <T>(comp: T): T => comp,
    Directions: {
      DOWN: 8,
      LEFT: 2,
      RIGHT: 1,
      UP: 4,
    },
    DrawerLayout: GestureHandler,
    FlatList: GestureHandler,
    FlingGestureHandler: GestureHandler,
    Gesture: {
      Exclusive: (..._gestures: unknown[]) => createChainableGesture(),
      Fling: () => createChainableGesture(),
      LongPress: () => createChainableGesture(),
      Manual: () => createChainableGesture(),
      Native: () => createChainableGesture(),
      Pan: () => createChainableGesture(),
      Pinch: () => createChainableGesture(),
      Race: (..._gestures: unknown[]) => createChainableGesture(),
      Rotation: () => createChainableGesture(),
      Simultaneous: (..._gestures: unknown[]) => createChainableGesture(),
      Tap: () => createChainableGesture(),
    },
    GestureDetector: GestureHandler,
    GestureHandlerRootView: GestureHandler,
    gestureHandlerRootHOC: <T>(comp: T): T => comp,
    LongPressGestureHandler: GestureHandler,
    NativeViewGestureHandler: GestureHandler,
    PanGestureHandler: GestureHandler,
    PinchGestureHandler: GestureHandler,
    RectButton: GestureHandler,
    RotationGestureHandler: GestureHandler,
    ScrollView: GestureHandler,
    State: {
      ACTIVE: 4,
      BEGAN: 2,
      CANCELLED: 3,
      END: 5,
      FAILED: 1,
      UNDETERMINED: 0,
    },
    Swipeable: GestureHandler,
    TapGestureHandler: GestureHandler,
    TouchableHighlight: GestureHandler,
    TouchableNativeFeedback: GestureHandler,
    TouchableOpacity: GestureHandler,
    TouchableWithoutFeedback: GestureHandler,
  };
});

// Mock react-native-reanimated
mock.module("react-native-reanimated", () => {
  const Animated = {
    createAnimatedComponent: <T>(comp: T): T => comp,
    Image: (props: MockComponentProps) => React.createElement("Image", props),
    ScrollView: ({children}: MockComponentProps) => React.createElement("ScrollView", {}, children),
    Text: ({children, style}: MockComponentProps) => React.createElement("Text", {style}, children),
    View: ({children, style}: MockComponentProps) => React.createElement("View", {style}, children),
  };
  return {
    default: Animated,
    Easing: {
      cubic: (t: number) => t,
      ease: (t: number) => t,
      linear: (t: number) => t,
      quad: (t: number) => t,
    },
    runOnJS: mock((fn: unknown) => fn),
    runOnUI: mock((fn: unknown) => fn),
    useAnimatedGestureHandler: mock(() => ({})),
    useAnimatedReaction: mock(() => undefined),
    useAnimatedStyle: mock((fn: () => unknown) => fn()),
    useDerivedValue: mock((fn: () => unknown) => ({value: fn()})),
    useSharedValue: mock((val: unknown) => ({value: val})),
    withDecay: mock((val: unknown) => val),
    withDelay: mock((_delay: unknown, val: unknown) => val),
    withRepeat: mock((val: unknown) => val),
    withSequence: mock((...vals: unknown[]) => vals[0]),
    withSpring: mock((val: unknown) => val),
    withTiming: mock((val: unknown) => val),
    ...Animated,
  };
});

// Mock react-native-svg
mock.module("react-native-svg", () => {
  const createSvgComponent =
    (name: string) =>
    ({children, ...props}: MockComponentProps) =>
      React.createElement(name, props, children);

  return {
    Circle: createSvgComponent("Circle"),
    ClipPath: createSvgComponent("ClipPath"),
    Defs: createSvgComponent("Defs"),
    default: createSvgComponent("Svg"),
    Ellipse: createSvgComponent("Ellipse"),
    ForeignObject: createSvgComponent("ForeignObject"),
    G: createSvgComponent("G"),
    Image: createSvgComponent("SvgImage"),
    Line: createSvgComponent("Line"),
    LinearGradient: createSvgComponent("LinearGradient"),
    Mask: createSvgComponent("Mask"),
    Path: createSvgComponent("Path"),
    Pattern: createSvgComponent("Pattern"),
    Polygon: createSvgComponent("Polygon"),
    Polyline: createSvgComponent("Polyline"),
    RadialGradient: createSvgComponent("RadialGradient"),
    Rect: createSvgComponent("Rect"),
    Stop: createSvgComponent("Stop"),
    Svg: createSvgComponent("Svg"),
    Symbol: createSvgComponent("Symbol"),
    Text: createSvgComponent("SvgText"),
    TextPath: createSvgComponent("TextPath"),
    TSpan: createSvgComponent("TSpan"),
    Use: createSvgComponent("Use"),
  };
});

// Mock expo-modules-core
mock.module("expo-modules-core/src/Refs", () => ({
  createRef: mock(() => ({current: null})),
}));

mock.module("expo-modules-core/src/web/index.web", () => ({
  EventEmitter: class EventEmitter {
    addListener = mock(() => {});
    removeListener = mock(() => {});
    removeAllListeners = mock(() => {});
    emit = mock(() => {});
  },
}));

mock.module("expo-modules-core/src/uuid/uuid.web", () => ({
  uuid4: mock(() => `mock-uuid-${Math.random().toString(36).substr(2, 9)}`),
}));

// Reset mock date before each test
beforeEach(() => {
  // Set a fixed date for testing
  const fixedDate = new Date("2023-05-15T10:30:00.000Z");
  global.Date.now = mock(() => fixedDate.getTime());
});
