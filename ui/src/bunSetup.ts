import {beforeEach, mock} from "bun:test";
import React from "react";

// Set environment variables
process.env.TZ = "America/New_York";
process.env.EXPO_OS = "ios";

// Define React Native globals
(globalThis as any).__DEV__ = true;
(globalThis as any).__BUNDLE_START_TIME__ = Date.now();

// Mock react-native to avoid Flow type errors
mock.module("react-native", () => {
  const View = ({children, style, testID, ...props}: any) =>
    React.createElement("View", {style, testID, ...props}, children);
  const Text = ({children, style, ...props}: any) =>
    React.createElement("Text", {style, ...props}, children);
  const TextInput = (props: any) => React.createElement("TextInput", props);
  const TouchableOpacity = ({children, ...props}: any) =>
    React.createElement("TouchableOpacity", props, children);
  const Pressable = ({children, ...props}: any) =>
    React.createElement("Pressable", props, children);
  const ScrollView = ({children, ...props}: any) =>
    React.createElement("ScrollView", props, children);
  const Image = (props: any) => React.createElement("Image", props);
  const ImageBackground = ({children, ...props}: any) => React.createElement("ImageBackground", props, children);
  const ActivityIndicator = (props: any) => React.createElement("ActivityIndicator", props);
  const FlatList = ({data, renderItem, keyExtractor, ...props}: any) =>
    React.createElement(
      "FlatList",
      props,
      data?.map((item: any, index: number) =>
        renderItem({item, index, separators: {highlight: () => {}, unhighlight: () => {}}})
      )
    );
  const SectionList = (props: any) => React.createElement("SectionList", props);
  const KeyboardAvoidingView = ({children, ...props}: any) =>
    React.createElement("KeyboardAvoidingView", props, children);
  const SafeAreaView = ({children, ...props}: any) =>
    React.createElement("SafeAreaView", props, children);
  const Modal = ({children, ...props}: any) => React.createElement("Modal", props, children);
  const Switch = (props: any) => React.createElement("Switch", props);
  const Animated = {
    View,
    Text,
    Image,
    ScrollView,
    FlatList,
    createAnimatedComponent: (comp: any) => comp,
    timing: mock(() => ({start: mock(() => {})})),
    spring: mock(() => ({start: mock(() => {})})),
    Value: class Value {
      constructor(public _value: number = 0) {}
      setValue = mock(() => {});
      interpolate = mock(() => this);
    },
    event: mock(() => () => {}),
  };
  const StyleSheet = {
    create: (styles: any) => styles,
    flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
    absoluteFill: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
    absoluteFillObject: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
    hairlineWidth: 1,
  };
  const Platform = {
    OS: "ios",
    select: (obj: any) => obj.ios || obj.default,
    Version: "14.0",
  };
  const Dimensions = {
    get: mock(() => ({width: 375, height: 812, scale: 2, fontScale: 1})),
    addEventListener: mock(() => ({remove: mock(() => {})})),
  };
  const useColorScheme = mock(() => "light");
  const useWindowDimensions = mock(() => ({width: 375, height: 812, scale: 2, fontScale: 1}));
  const Keyboard = {
    dismiss: mock(() => {}),
    addListener: mock(() => ({remove: mock(() => {})})),
  };
  const LayoutAnimation = {
    configureNext: mock(() => {}),
    create: mock(() => ({})),
    Types: {},
    Properties: {},
    Presets: {},
  };
  const Linking = {
    openURL: mock(() => Promise.resolve()),
    canOpenURL: mock(() => Promise.resolve(true)),
    getInitialURL: mock(() => Promise.resolve(null)),
    addEventListener: mock(() => ({remove: mock(() => {})})),
  };
  const Alert = {
    alert: mock(() => {}),
  };
  const Appearance = {
    getColorScheme: mock(() => "light"),
    addChangeListener: mock(() => ({remove: mock(() => {})})),
  };
  const Vibration = {
    vibrate: mock(() => {}),
    cancel: mock(() => {}),
  };
  const NativeModules = {};
  const StatusBar = {
    setBarStyle: mock(() => {}),
    setBackgroundColor: mock(() => {}),
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
    share: mock(() => Promise.resolve({action: "sharedAction"})),
    dismiss: mock(() => Promise.resolve()),
  };
  const PixelRatio = {
    get: mock(() => 2),
    getFontScale: mock(() => 1),
    getPixelSizeForLayoutSize: mock((size: number) => size * 2),
    roundToNearestPixel: mock((size: number) => size),
  };
  const I18nManager = {
    isRTL: false,
    doLeftAndRightSwapInRTL: true,
    allowRTL: mock(() => {}),
    forceRTL: mock(() => {}),
    swapLeftAndRightInRTL: mock(() => {}),
  };
  const BackHandler = {
    addEventListener: mock(() => ({remove: mock(() => {})})),
    exitApp: mock(() => {}),
  };
  const TouchableWithoutFeedback = ({children, ...props}: any) =>
    React.createElement("TouchableWithoutFeedback", props, children);
  const TouchableHighlight = ({children, ...props}: any) =>
    React.createElement("TouchableHighlight", props, children);
  const TouchableNativeFeedback = ({children, ...props}: any) =>
    React.createElement("TouchableNativeFeedback", props, children);
  const Touchable = {
    Mixin: {
      touchableGetInitialState: () => ({}),
      touchableHandleStartShouldSetResponder: () => true,
      touchableHandleResponderTerminationRequest: () => true,
      touchableHandleResponderGrant: mock(() => {}),
      touchableHandleResponderMove: mock(() => {}),
      touchableHandleResponderRelease: mock(() => {}),
      touchableHandleResponderTerminate: mock(() => {}),
    },
    TOUCH_TARGET_DEBUG: false,
    renderDebugView: mock(() => null),
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
      panHandlers: {
        onStartShouldSetResponder: mock(() => false),
        onMoveShouldSetResponder: mock(() => false),
        onStartShouldSetResponderCapture: mock(() => false),
        onMoveShouldSetResponderCapture: mock(() => false),
        onResponderGrant: mock(() => {}),
        onResponderMove: mock(() => {}),
        onResponderRelease: mock(() => {}),
        onResponderTerminate: mock(() => {}),
        onResponderTerminationRequest: mock(() => true),
        onResponderReject: mock(() => {}),
        onResponderStart: mock(() => {}),
        onResponderEnd: mock(() => {}),
      },
      getInteractionHandle: mock(() => null),
    })),
  };
  const Easing = {
    linear: mock((t: number) => t),
    ease: mock((t: number) => t),
    quad: mock((t: number) => t * t),
    cubic: mock((t: number) => t * t * t),
    poly: mock(() => (t: number) => t),
    sin: mock((t: number) => Math.sin(t)),
    circle: mock((t: number) => t),
    exp: mock((t: number) => t),
    elastic: mock(() => (t: number) => t),
    back: mock(() => (t: number) => t),
    bounce: mock((t: number) => t),
    bezier: mock(() => (t: number) => t),
    in: mock((f: any) => f),
    out: mock((f: any) => f),
    inOut: mock((f: any) => f),
  };
  const NativeEventEmitter = class {
    constructor(_nativeModule?: any) {}
    addListener = mock(() => ({remove: mock(() => {})}));
    removeAllListeners = mock(() => {});
    removeSubscription = mock(() => {});
  };

  return {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Pressable,
    ScrollView,
    Image,
    ImageBackground,
    ActivityIndicator,
    FlatList,
    SectionList,
    KeyboardAvoidingView,
    SafeAreaView,
    Modal,
    Switch,
    Animated,
    StyleSheet,
    Platform,
    Dimensions,
    useColorScheme,
    useWindowDimensions,
    Keyboard,
    LayoutAnimation,
    Linking,
    Alert,
    Appearance,
    Vibration,
    NativeModules,
    StatusBar,
    AccessibilityInfo,
    Share,
    PixelRatio,
    I18nManager,
    BackHandler,
    TouchableWithoutFeedback,
    TouchableHighlight,
    TouchableNativeFeedback,
    Touchable,
    processColor,
    UIManager,
    findNodeHandle,
    requireNativeComponent,
    TurboModuleRegistry,
    PanResponder,
    Easing,
    NativeEventEmitter,
    default: {
      View,
      Text,
      TextInput,
      TouchableOpacity,
      Pressable,
      ScrollView,
      Image,
      ImageBackground,
      ActivityIndicator,
      FlatList,
      SectionList,
      KeyboardAvoidingView,
      SafeAreaView,
      Modal,
      Switch,
      Animated,
      StyleSheet,
      Platform,
      Dimensions,
      useColorScheme,
      useWindowDimensions,
      Keyboard,
      LayoutAnimation,
      Linking,
      Alert,
      Appearance,
      Vibration,
      NativeModules,
      StatusBar,
      AccessibilityInfo,
      Share,
      PixelRatio,
      I18nManager,
      BackHandler,
      TouchableWithoutFeedback,
      TouchableHighlight,
      TouchableNativeFeedback,
      Touchable,
      processColor,
      UIManager,
      findNodeHandle,
      requireNativeComponent,
      TurboModuleRegistry,
      PanResponder,
      Easing,
      NativeEventEmitter,
    },
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
  } as any;
}

// Mock @react-native-async-storage/async-storage
mock.module("@react-native-async-storage/async-storage", () => ({
  setItem: mock(() => Promise.resolve()),
  getItem: mock(() => Promise.resolve(null)),
  removeItem: mock(() => Promise.resolve()),
  clear: mock(() => Promise.resolve()),
  getAllKeys: mock(() => Promise.resolve([])),
  multiGet: mock(() => Promise.resolve([])),
  multiSet: mock(() => Promise.resolve()),
  multiRemove: mock(() => Promise.resolve()),
  mergeItem: mock(() => Promise.resolve()),
  default: {
    setItem: mock(() => Promise.resolve()),
    getItem: mock(() => Promise.resolve(null)),
    removeItem: mock(() => Promise.resolve()),
    clear: mock(() => Promise.resolve()),
    getAllKeys: mock(() => Promise.resolve([])),
    multiGet: mock(() => Promise.resolve([])),
    multiSet: mock(() => Promise.resolve()),
    multiRemove: mock(() => Promise.resolve()),
    mergeItem: mock(() => Promise.resolve()),
  },
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
  loadNativeFonts: mock(() => Promise.resolve()),
  loadAsync: mock(() => Promise.resolve()),
  useFonts: mock(() => [true, null]),
}));

// Mock Google fonts packages
mock.module("@expo-google-fonts/nunito", () => ({
  useFonts: mock(() => [true, null]),
  Nunito_200ExtraLight: "Nunito_200ExtraLight",
  Nunito_300Light: "Nunito_300Light",
  Nunito_400Regular: "Nunito_400Regular",
  Nunito_500Medium: "Nunito_500Medium",
  Nunito_600SemiBold: "Nunito_600SemiBold",
  Nunito_700Bold: "Nunito_700Bold",
  Nunito_800ExtraBold: "Nunito_800ExtraBold",
  Nunito_900Black: "Nunito_900Black",
  Nunito_200ExtraLight_Italic: "Nunito_200ExtraLight_Italic",
  Nunito_300Light_Italic: "Nunito_300Light_Italic",
  Nunito_400Regular_Italic: "Nunito_400Regular_Italic",
  Nunito_500Medium_Italic: "Nunito_500Medium_Italic",
  Nunito_600SemiBold_Italic: "Nunito_600SemiBold_Italic",
  Nunito_700Bold_Italic: "Nunito_700Bold_Italic",
  Nunito_800ExtraBold_Italic: "Nunito_800ExtraBold_Italic",
  Nunito_900Black_Italic: "Nunito_900Black_Italic",
}));

mock.module("@expo-google-fonts/titillium-web", () => ({
  useFonts: mock(() => [true, null]),
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
    PNG: "png",
    JPEG: "jpeg",
  },
}));

// Mock expo-image-picker
mock.module("expo-image-picker", () => ({
  launchImageLibraryAsync: mock(() => {}),
  requestMediaLibraryPermissionsAsync: mock(() => {}),
  MediaTypeOptions: {
    Images: "images",
  },
}));

// Mock expo-haptics
mock.module("expo-haptics", () => ({
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
  impactAsync: mock(() => {}),
  notificationAsync: mock(() => {}),
  selectionAsync: mock(() => {}),
}));

// Mock expo-clipboard
mock.module("expo-clipboard", () => ({
  getStringAsync: mock(() => Promise.resolve("")),
  setStringAsync: mock(() => Promise.resolve(undefined)),
  hasStringAsync: mock(() => Promise.resolve(false)),
}));

// Mock expo-localization
mock.module("expo-localization", () => ({
  getCalendars: mock(() => [
    {
      id: "gregorian",
      calendar: "gregorian",
      locale: "en-US",
      timeZone: "America/New_York",
    },
  ]),
  getLocales: mock(() => [
    {
      languageCode: "en",
      countryCode: "US",
      textDirection: "ltr",
      digitGroupingSeparator: ",",
      decimalSeparator: ".",
      measurementSystem: "US",
      uses24hourClock: false,
      usesMetricSystem: false,
      temperatureUnit: "F",
    },
  ]),
  timezone: "America/New_York",
  isRTL: false,
  locale: "en-US",
  locales: ["en-US"],
}));

// Mock @expo/vector-icons
mock.module("@expo/vector-icons", () => ({
  FontAwesome6: mock(() => null),
  default: mock(() => null),
}));

// Mock @expo/vector-icons/FontAwesome6
mock.module("@expo/vector-icons/FontAwesome6", () => ({
  default: mock(() => null),
}));

// Mock linkify-it - need to mock the Hyperlink component directly instead
mock.module("./Hyperlink", () => ({
  Hyperlink: ({children}: any) => React.createElement("View", {}, children),
}));

// Mock react-native internal modules with Flow types
// These modules use Flow type syntax that Bun cannot parse

// StyleSheet related
mock.module("react-native/Libraries/StyleSheet/processColor", () => {
  const processColor = (color: any) => {
    if (color === null || color === undefined) return null;
    if (typeof color === "number") return color;
    return 0xff000000;
  };
  return { default: processColor, __esModule: true };
});

mock.module("react-native/Libraries/StyleSheet/normalizeColor", () => {
  const normalizeColor = (color: any) => {
    if (color === null || color === undefined) return null;
    if (typeof color === "number") return color;
    return 0xff000000;
  };
  return { default: normalizeColor, __esModule: true };
});

mock.module("react-native/Libraries/StyleSheet/PlatformColorValueTypes", () => ({
  PlatformColor: (...args: any[]) => args[0],
  DynamicColorIOS: (obj: any) => obj.light,
  normalizeColorObject: (color: any) => color,
  processColorObject: (color: any) => color,
}));

mock.module("react-native/Libraries/StyleSheet/StyleSheet", () => ({
  default: {
    create: (styles: any) => styles,
    flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
    absoluteFill: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
    absoluteFillObject: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
    hairlineWidth: 1,
  },
  create: (styles: any) => styles,
  flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
  absoluteFill: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
  absoluteFillObject: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
  hairlineWidth: 1,
}));

// NativeComponent related
mock.module("react-native/Libraries/NativeComponent/NativeComponentRegistry", () => ({
  get: mock(() => "View"),
  getWithFallback_DEPRECATED: mock(() => "View"),
  setRuntimeConfigProvider: mock(() => {}),
}));

mock.module("react-native/Libraries/NativeComponent/ViewConfigIgnore", () => ({
  DifferentHeuristics: {},
  ignoredViewConfigPropNames: new Set(),
  isIgnoredViewConfigProp: mock(() => false),
  ConditionallyIgnoredEventHandlers: (handlers: any) => handlers,
}));

// Mock @react-native-community/slider
mock.module("@react-native-community/slider", () => ({
  default: (props: any) => React.createElement("Slider", props),
  Slider: (props: any) => React.createElement("Slider", props),
}));

// Mock react-native-swiper-flatlist
mock.module("react-native-swiper-flatlist", () => ({
  SwiperFlatList: ({children, ...props}: any) => React.createElement("SwiperFlatList", props, children),
  default: ({children, ...props}: any) => React.createElement("SwiperFlatList", props, children),
}));

// Mock Unifier module
mock.module("./Unifier", () => ({
  Unifier: {
    web: false,
    dev: false,
    navigation: {
      dismissOverlay: mock(() => {}),
    },
    utils: {
      dismissKeyboard: mock(() => {}),
      dimensions: mock(() => ({width: 375, height: 812})),
      copyToClipboard: mock(() => {}),
      orientationChange: mock(() => {}),
      requestPermissions: mock(() => Promise.resolve(true)),
      makePurchase: mock(() => {}),
      PaymentService: mock(() => {}),
      vibrate: mock(() => {}),
      haptic: mock(() => Promise.resolve()),
      openUrl: mock(() => Promise.resolve()),
    },
    storage: {
      getItem: mock(() => Promise.resolve(null)),
      setItem: mock(() => Promise.resolve()),
    },
    tracking: {
      log: mock(() => {}),
    },
    initIcons: mock(() => {}),
  },
  changeColorLuminance: mock((hex: string, luminanceChange: string) => hex),
}));

mock.module("react-native/Libraries/Utilities/codegenNativeComponent", () => ({
  default: mock((name: string) => name),
}));

mock.module("react-native/Libraries/Utilities/codegenNativeCommands", () => ({
  default: mock(() => ({})),
}));

// Image related
mock.module("react-native/Libraries/Image/resolveAssetSource", () => {
  const resolveAssetSource = (source: any) => ({
    uri: source?.uri || "",
    width: source?.width || 0,
    height: source?.height || 0,
    scale: 1,
  });
  return { default: resolveAssetSource, __esModule: true };
});

mock.module("react-native/Libraries/Image/AssetSourceResolver", () => ({
  default: class AssetSourceResolver {
    constructor() {}
    defaultAsset = () => ({uri: "", width: 0, height: 0, scale: 1});
    fromSource = () => ({uri: "", width: 0, height: 0, scale: 1});
  },
}));

mock.module("react-native/Libraries/Image/ImageSource", () => ({
  default: {},
}));

// Animated related
mock.module("react-native/Libraries/Animated/Animated", () => {
  const View = ({children, style}: any) => React.createElement("View", {style}, children);
  const Text = ({children, style}: any) => React.createElement("Text", {style}, children);
  const Image = (props: any) => React.createElement("Image", props);
  const ScrollView = ({children}: any) => React.createElement("ScrollView", {}, children);
  return {
    default: { View, Text, Image, ScrollView, createAnimatedComponent: (c: any) => c },
    View, Text, Image, ScrollView, createAnimatedComponent: (c: any) => c,
  };
});

mock.module("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({
  default: {},
  shouldUseNativeDriver: () => false,
}));

// Event related
mock.module("react-native/Libraries/EventEmitter/NativeEventEmitter", () => ({
  default: class NativeEventEmitter {
    constructor() {}
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
  default: { OS: "ios", select: (obj: any) => obj.ios || obj.default, Version: "14.0" },
  OS: "ios",
  select: (obj: any) => obj.ios || obj.default,
  Version: "14.0",
}));

mock.module("react-native/Libraries/Utilities/Dimensions", () => ({
  default: {
    get: () => ({width: 375, height: 812, scale: 2, fontScale: 1}),
    addEventListener: () => ({remove: () => {}}),
  },
  get: () => ({width: 375, height: 812, scale: 2, fontScale: 1}),
  addEventListener: () => ({remove: () => {}}),
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
  default: () => ({width: 375, height: 812, scale: 2, fontScale: 1}),
}));

mock.module("react-native/Libraries/Utilities/useColorScheme", () => ({
  default: () => "light",
}));

// Components
mock.module("react-native/Libraries/Components/View/View", () => ({
  default: ({children, style, testID, ...props}: any) =>
    React.createElement("View", {style, testID, ...props}, children),
}));

mock.module("react-native/Libraries/Text/Text", () => ({
  default: ({children, style, ...props}: any) =>
    React.createElement("Text", {style, ...props}, children),
}));

mock.module("react-native/Libraries/Components/TextInput/TextInput", () => ({
  default: (props: any) => React.createElement("TextInput", props),
}));

mock.module("react-native/Libraries/Image/Image", () => ({
  default: (props: any) => React.createElement("Image", props),
}));

mock.module("react-native/Libraries/Components/ScrollView/ScrollView", () => ({
  default: ({children, ...props}: any) => React.createElement("ScrollView", props, children),
}));

mock.module("react-native/Libraries/Components/Pressable/Pressable", () => ({
  default: ({children, ...props}: any) => React.createElement("Pressable", props, children),
}));

mock.module("react-native/Libraries/Components/Touchable/TouchableOpacity", () => ({
  default: ({children, ...props}: any) => React.createElement("TouchableOpacity", props, children),
}));

mock.module("react-native/Libraries/Components/ActivityIndicator/ActivityIndicator", () => ({
  default: (props: any) => React.createElement("ActivityIndicator", props),
}));

mock.module("react-native/Libraries/Modal/Modal", () => ({
  default: ({children, ...props}: any) => React.createElement("Modal", props, children),
}));

mock.module("react-native/Libraries/Components/Switch/Switch", () => ({
  default: (props: any) => React.createElement("Switch", props),
}));

mock.module("react-native/Libraries/Lists/FlatList", () => ({
  default: ({data, renderItem, ...props}: any) =>
    React.createElement("FlatList", props, data?.map((item: any, index: number) =>
      renderItem({item, index, separators: {highlight: () => {}, unhighlight: () => {}}})
    )),
}));

mock.module("react-native/Libraries/Lists/SectionList", () => ({
  default: (props: any) => React.createElement("SectionList", props),
}));

// APIs
mock.module("react-native/Libraries/Alert/Alert", () => ({
  default: { alert: mock(() => {}) },
}));

mock.module("react-native/Libraries/Linking/Linking", () => ({
  default: {
    openURL: mock(() => Promise.resolve()),
    canOpenURL: mock(() => Promise.resolve(true)),
    getInitialURL: mock(() => Promise.resolve(null)),
    addEventListener: mock(() => ({remove: mock(() => {})})),
  },
}));

mock.module("react-native/Libraries/Share/Share", () => ({
  default: {
    share: mock(() => Promise.resolve({action: "sharedAction"})),
    dismiss: mock(() => Promise.resolve()),
  },
}));

mock.module("react-native/Libraries/Vibration/Vibration", () => ({
  default: {
    vibrate: mock(() => {}),
    cancel: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/Components/Keyboard/Keyboard", () => ({
  default: {
    dismiss: mock(() => {}),
    addListener: mock(() => ({remove: mock(() => {})})),
  },
}));

mock.module("react-native/Libraries/AppState/AppState", () => ({
  default: {
    currentState: "active",
    addEventListener: mock(() => ({remove: mock(() => {})})),
  },
}));

mock.module("react-native/Libraries/Interaction/PanResponder", () => ({
  default: {
    create: mock(() => ({
      panHandlers: {},
      getInteractionHandle: mock(() => null),
    })),
  },
}));

mock.module("react-native/Libraries/LayoutAnimation/LayoutAnimation", () => ({
  default: {
    configureNext: mock(() => {}),
    create: mock(() => ({})),
    Types: {},
    Properties: {},
    Presets: {},
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
    setBarStyle: mock(() => {}),
    setBackgroundColor: mock(() => {}),
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
    getColorScheme: mock(() => "light"),
    addChangeListener: mock(() => ({remove: mock(() => {})})),
  },
}));

mock.module("react-native/Libraries/ReactNative/I18nManager", () => ({
  default: {
    isRTL: false,
    doLeftAndRightSwapInRTL: true,
    allowRTL: mock(() => {}),
    forceRTL: mock(() => {}),
    swapLeftAndRightInRTL: mock(() => {}),
  },
}));

mock.module("react-native/Libraries/BatchedBridge/NativeModules", () => ({
  default: {},
}));

mock.module("react-native/Libraries/Animated/Easing", () => ({
  default: {
    linear: (t: number) => t,
    ease: (t: number) => t,
    quad: (t: number) => t * t,
    cubic: (t: number) => t * t * t,
    poly: () => (t: number) => t,
    sin: (t: number) => Math.sin(t),
    circle: (t: number) => t,
    exp: (t: number) => t,
    elastic: () => (t: number) => t,
    back: () => (t: number) => t,
    bounce: (t: number) => t,
    bezier: () => (t: number) => t,
    in: (f: any) => f,
    out: (f: any) => f,
    inOut: (f: any) => f,
  },
}));

mock.module("react-native/Libraries/Components/Touchable/Touchable", () => ({
  default: {
    Mixin: {
      touchableGetInitialState: () => ({}),
      touchableHandleStartShouldSetResponder: () => true,
      touchableHandleResponderTerminationRequest: () => true,
      touchableHandleResponderGrant: mock(() => {}),
      touchableHandleResponderMove: mock(() => {}),
      touchableHandleResponderRelease: mock(() => {}),
      touchableHandleResponderTerminate: mock(() => {}),
    },
    TOUCH_TARGET_DEBUG: false,
    renderDebugView: mock(() => null),
  },
  Mixin: {
    touchableGetInitialState: () => ({}),
    touchableHandleStartShouldSetResponder: () => true,
    touchableHandleResponderTerminationRequest: () => true,
    touchableHandleResponderGrant: mock(() => {}),
    touchableHandleResponderMove: mock(() => {}),
    touchableHandleResponderRelease: mock(() => {}),
    touchableHandleResponderTerminate: mock(() => {}),
  },
}));

// Additional internal modules
mock.module("react-native/Libraries/vendor/core/ErrorUtils", () => ({
  default: {
    setGlobalHandler: mock(() => {}),
    getGlobalHandler: mock(() => () => {}),
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
    install: mock(() => {}),
    uninstall: mock(() => {}),
    ignoreLogs: mock(() => {}),
    ignoreAllLogs: mock(() => {}),
  },
}));

// Mock @react-native-picker/picker
const PickerComponent = ({children, ...props}: any) => React.createElement("Picker", props, children);
(PickerComponent as any).Item = ({children, ...props}: any) => React.createElement("Picker.Item", props, children);
mock.module("@react-native-picker/picker", () => ({
  Picker: PickerComponent,
  PickerIOS: PickerComponent,
}));

// Mock react-native-picker-select
mock.module("react-native-picker-select", () => ({
  default: ({children, ...props}: any) => React.createElement("RNPickerSelect", props, children),
}));

// Mock @react-native-community/datetimepicker
mock.module("@react-native-community/datetimepicker", () => ({
  default: (props: any) => React.createElement("DateTimePicker", props),
  DateTimePickerAndroid: {
    open: mock(() => Promise.resolve({action: "dismissed"})),
    dismiss: mock(() => Promise.resolve()),
  },
}));

// Mock react-native-calendars
mock.module("react-native-calendars", () => ({
  Calendar: (props: any) => React.createElement("Calendar", props),
  CalendarList: (props: any) => React.createElement("CalendarList", props),
  Agenda: (props: any) => React.createElement("Agenda", props),
  AgendaList: (props: any) => React.createElement("AgendaList", props),
  ExpandableCalendar: (props: any) => React.createElement("ExpandableCalendar", props),
  WeekCalendar: (props: any) => React.createElement("WeekCalendar", props),
  LocaleConfig: {
    locales: {},
    defaultLocale: "en",
  },
}));

// Mock more react-native internal modules with Flow types
mock.module("react-native/Libraries/Image/resolveAssetSource", () => ({
  default: mock((source: any) => ({
    uri: source?.uri || "",
    width: source?.width || 0,
    height: source?.height || 0,
    scale: 1,
  })),
}));

mock.module("react-native/Libraries/Image/AssetSourceResolver", () => ({
  default: class AssetSourceResolver {
    constructor() {}
    defaultAsset = mock(() => ({uri: "", width: 0, height: 0, scale: 1}));
    fromSource = mock(() => ({uri: "", width: 0, height: 0, scale: 1}));
  },
}));

// Mock react-native-gesture-handler
mock.module("react-native-gesture-handler", () => {
  const GestureHandler = ({children}: any) => children;
  
  // Create a chainable gesture object that returns itself for all method calls
  const createChainableGesture = (): any => {
    const gesture: any = {};
    const chainableMethods = [
      "onStart", "onEnd", "onUpdate", "onChange", "onFinalize", "onTouchesDown",
      "onTouchesMove", "onTouchesUp", "onTouchesCancelled", "enabled", "shouldCancelWhenOutside",
      "hitSlop", "simultaneousWithExternalGesture", "requireExternalGestureToFail",
      "blocksExternalGesture", "withTestId", "minPointers", "maxPointers",
      "minDistance", "minVelocity", "minVelocityX", "minVelocityY", "activeOffsetX",
      "activeOffsetY", "failOffsetX", "failOffsetY", "averageTouches", "enableTrackpadTwoFingerGesture",
      "numberOfTaps", "maxDuration", "maxDelay", "maxDist", "minDuration",
      "numberOfPointers", "direction", "minScale", "minRotation", "runOnJS",
    ];
    chainableMethods.forEach(method => {
      gesture[method] = mock(() => gesture);
    });
    return gesture;
  };
  
  return {
    GestureHandlerRootView: GestureHandler,
    GestureDetector: GestureHandler,
    Gesture: {
      Pan: () => createChainableGesture(),
      Tap: () => createChainableGesture(),
      LongPress: () => createChainableGesture(),
      Pinch: () => createChainableGesture(),
      Rotation: () => createChainableGesture(),
      Fling: () => createChainableGesture(),
      Native: () => createChainableGesture(),
      Manual: () => createChainableGesture(),
      Race: (...gestures: any[]) => createChainableGesture(),
      Simultaneous: (...gestures: any[]) => createChainableGesture(),
      Exclusive: (...gestures: any[]) => createChainableGesture(),
    },
    Directions: {
      RIGHT: 1,
      LEFT: 2,
      UP: 4,
      DOWN: 8,
    },
    State: {
      UNDETERMINED: 0,
      FAILED: 1,
      BEGAN: 2,
      CANCELLED: 3,
      ACTIVE: 4,
      END: 5,
    },
    PanGestureHandler: GestureHandler,
    TapGestureHandler: GestureHandler,
    LongPressGestureHandler: GestureHandler,
    PinchGestureHandler: GestureHandler,
    RotationGestureHandler: GestureHandler,
    FlingGestureHandler: GestureHandler,
    NativeViewGestureHandler: GestureHandler,
    gestureHandlerRootHOC: (comp: any) => comp,
    Swipeable: GestureHandler,
    DrawerLayout: GestureHandler,
    ScrollView: GestureHandler,
    FlatList: GestureHandler,
    TouchableOpacity: GestureHandler,
    TouchableHighlight: GestureHandler,
    TouchableWithoutFeedback: GestureHandler,
    TouchableNativeFeedback: GestureHandler,
    RectButton: GestureHandler,
    BorderlessButton: GestureHandler,
    BaseButton: GestureHandler,
    createNativeWrapper: (comp: any) => comp,
  };
});

// Mock react-native-reanimated
mock.module("react-native-reanimated", () => {
  const Animated = {
    View: ({children, style}: any) => React.createElement("View", {style}, children),
    Text: ({children, style}: any) => React.createElement("Text", {style}, children),
    Image: (props: any) => React.createElement("Image", props),
    ScrollView: ({children}: any) => React.createElement("ScrollView", {}, children),
    createAnimatedComponent: (comp: any) => comp,
  };
  return {
    default: Animated,
    useSharedValue: mock((val: any) => ({value: val})),
    useAnimatedStyle: mock((fn: any) => fn()),
    useDerivedValue: mock((fn: any) => ({value: fn()})),
    useAnimatedGestureHandler: mock(() => ({})),
    withTiming: mock((val: any) => val),
    withSpring: mock((val: any) => val),
    withDecay: mock((val: any) => val),
    withSequence: mock((...vals: any[]) => vals[0]),
    withRepeat: mock((val: any) => val),
    withDelay: mock((delay: any, val: any) => val),
    runOnJS: mock((fn: any) => fn),
    runOnUI: mock((fn: any) => fn),
    Easing: {
      linear: (t: number) => t,
      ease: (t: number) => t,
      quad: (t: number) => t,
      cubic: (t: number) => t,
    },
    ...Animated,
  };
});

// Mock react-native-svg
mock.module("react-native-svg", () => {
  const createSvgComponent = (name: string) =>
    ({children, ...props}: any) => React.createElement(name, props, children);
  
  return {
    Svg: createSvgComponent("Svg"),
    Circle: createSvgComponent("Circle"),
    Ellipse: createSvgComponent("Ellipse"),
    G: createSvgComponent("G"),
    Text: createSvgComponent("SvgText"),
    TSpan: createSvgComponent("TSpan"),
    TextPath: createSvgComponent("TextPath"),
    Path: createSvgComponent("Path"),
    Polygon: createSvgComponent("Polygon"),
    Polyline: createSvgComponent("Polyline"),
    Line: createSvgComponent("Line"),
    Rect: createSvgComponent("Rect"),
    Use: createSvgComponent("Use"),
    Image: createSvgComponent("SvgImage"),
    Symbol: createSvgComponent("Symbol"),
    Defs: createSvgComponent("Defs"),
    LinearGradient: createSvgComponent("LinearGradient"),
    RadialGradient: createSvgComponent("RadialGradient"),
    Stop: createSvgComponent("Stop"),
    ClipPath: createSvgComponent("ClipPath"),
    Pattern: createSvgComponent("Pattern"),
    Mask: createSvgComponent("Mask"),
    ForeignObject: createSvgComponent("ForeignObject"),
    default: createSvgComponent("Svg"),
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
  uuid4: mock(() => "mock-uuid-" + Math.random().toString(36).substr(2, 9)),
}));

// Reset mock date before each test
beforeEach(() => {
  // Set a fixed date for testing
  const fixedDate = new Date("2023-05-15T10:30:00.000Z");
  global.Date.now = mock(() => fixedDate.getTime());
});

export {};

