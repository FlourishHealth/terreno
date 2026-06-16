import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {Dimensions, Keyboard, Linking, Platform, Vibration} from "react-native";

import type {PermissionKind} from "./Common";
import {requestPermissions} from "./Permissions";

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: Google Maps JS SDK global type is loaded dynamically and not bundled as a typed dependency
    google: any;
  }
}

export type PlatformOS = "ios" | "android" | "web";

type Luminance = "light" | "lighter" | "dark" | "darker";

// Changes a color luminance
export const changeColorLuminance = (hex: string, luminanceChange: Luminance) => {
  let normalizedHex = String(hex).replace(/[^0-9a-f]/gi, "");
  if (normalizedHex.length === 3) {
    normalizedHex =
      normalizedHex[0] +
      normalizedHex[0] +
      normalizedHex[1] +
      normalizedHex[1] +
      normalizedHex[2] +
      normalizedHex[2];
  } else if (normalizedHex.length !== 6) {
    throw new Error(`Invalid color hex: ${normalizedHex}`);
  }
  let luminance: number;
  switch (luminanceChange) {
    case "light":
      luminance = -0.2;
      break;
    case "lighter":
      luminance = -0.33;
      break;
    case "dark":
      luminance = 0.2;
      break;
    case "darker":
      luminance = 0.33;
      break;
    default:
      throw new Error(`Cannot change luminance to ${luminanceChange}`);
  }

  let rgb = "#";
  for (let i = 0; i < 3; i++) {
    const decimal = parseInt(normalizedHex.substr(i * 2, 2), 16);
    const appliedLuminance = Math.round(
      Math.min(Math.max(0, decimal + decimal * luminance), 255)
    ).toString(16);
    rgb += `00${appliedLuminance}`.substr(appliedLuminance.length);
  }

  return rgb;
};

class UnifierClass {
  private _web = false;

  private _dev = false;

  get web(): boolean {
    return this._web;
  }

  get dev(): boolean {
    return this._dev;
  }

  navigation = {
    dismissOverlay: () => {
      console.warn("Dismiss overlay not supported.");
    },
  };

  // tracking: Tracking,
  utils = {
    copyToClipboard: (text: string) => {
      void Clipboard.setStringAsync(text);
    },
    dimensions: () => ({
      height: Dimensions.get("window").height,
      width: Dimensions.get("window").width,
    }),
    dismissKeyboard: () => {
      Keyboard.dismiss();
    },
    haptic: () => {
      if (Platform.OS !== "web") {
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return;
    },
    makePurchase: () => {
      console.warn("Make purchase not supported yet.");
    },
    openUrl: async (url: string) => {
      return Linking.openURL(url);
    },
    orientationChange: (callback: (orientation: "portrait" | "landscape") => void) => {
      Dimensions.addEventListener("change", () => {
        const screen = Dimensions.get("screen");
        const isPortrait = screen.width < screen.height;
        callback(isPortrait ? "portrait" : "landscape");
      });
    },
    PaymentService: () => {
      console.warn("Make purchase not supported yet.");
    },
    requestPermissions: async (_perm: PermissionKind) => {
      return requestPermissions(_perm);
      // return requestPermissions(perm);
    },
    vibrate: (pattern?: number[]) => {
      Vibration.vibrate(pattern || [100], false);
    },
    // keepAwake: (activate: boolean) => {
    //   if (activate) {
    //     activateKeepAwake();
    //   } else {
    //     deactivateKeepAwake();
    //   }
    // },
  };

  storage = {
    getItem: async (key: string, defaultValue?: unknown) => {
      try {
        const jsonValue = await AsyncStorage.getItem(key);
        if (jsonValue) {
          const value = JSON.parse(jsonValue);
          if (value === null || value === undefined) {
            return defaultValue;
          } else {
            return value;
          }
        } else if (defaultValue !== undefined) {
          return defaultValue;
        } else {
          return null;
        }
      } catch (error) {
        console.error(`[storage] Error reading ${key}`, error);
        return defaultValue || null;
      }
    },
    setItem: async (key: string, item: unknown) => {
      try {
        const jsonValue = JSON.stringify(item);
        await AsyncStorage.setItem(key, jsonValue);
      } catch (error: unknown) {
        console.error(`[storage] Error storing ${key}`, item, error);
        throw new Error(error instanceof Error ? error.message : String(error));
      }
    },
  };

  tracking = {
    log: (message: string) => {
      console.info(message);
    },
  };

  initIcons = () => {
    console.debug("[unifier] Initializing icons");
  };
}

export const Unifier = new UnifierClass();
