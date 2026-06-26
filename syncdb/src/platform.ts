import {Platform} from "react-native";

/** True when running on React Native Web (uses localStorage persistence). */
export const IsWeb = Platform.OS === "web";
