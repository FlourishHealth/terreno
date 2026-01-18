export * from "./sentry";

import {Platform} from "react-native";

export const IsWeb = Platform.OS === "web";

// User type constants for online status toggling
export const UserTypes = {
  FamilyMember: "familyMember",
  Patient: "patient",
} as const;
