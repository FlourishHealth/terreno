import React from "react";
import {Image as RNImage} from "react-native";

const CARD_WIDTH = 300;
const CARD_HEIGHT = 280;
const DEMO_BANNER_WIDTH = CARD_WIDTH * 2 + 16;
const DEMO_BANNER_HEIGHT = CARD_HEIGHT;
const DEMO_BANNER_SOURCE = require("../assets/terreno-garden-banner.png");

export const DemoHomeBanner: React.FC = (): React.ReactElement => {
  return (
    <RNImage
      accessibilityLabel="Terreno Garden — Demo and Docs"
      resizeMode="cover"
      source={DEMO_BANNER_SOURCE}
      style={{
        borderRadius: 16,
        height: DEMO_BANNER_HEIGHT,
        margin: 8,
        maxWidth: "100%",
        width: DEMO_BANNER_WIDTH,
      }}
      testID="demo-home-banner"
    />
  );
};
