import React from "react";
import {
  ImageBackground as ImageBackgroundNative,
  type ImageBackgroundProps as NativeImageBackgroundProps,
} from "react-native";

type ImageBackgroundProps = NativeImageBackgroundProps;

export class ImageBackground extends React.Component<ImageBackgroundProps, {}> {
  render() {
    return <ImageBackgroundNative {...this.props} />;
  }
}
