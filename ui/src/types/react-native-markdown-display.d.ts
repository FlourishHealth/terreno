import type {ComponentType} from "react";
import type {ImageProps} from "react-native";

declare module "react-native-markdown-display" {
  export const FitImage: ComponentType<ImageProps & {indicator?: boolean}>;
}
