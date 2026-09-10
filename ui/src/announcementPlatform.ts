import {Platform} from "react-native";

export type AnnouncementPlatform = "android" | "ios" | "web";

export const getAnnouncementPlatform = (): AnnouncementPlatform => {
  if (Platform.OS === "ios") {
    return "ios";
  }
  if (Platform.OS === "android") {
    return "android";
  }
  return "web";
};
