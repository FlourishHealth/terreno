import {Banner, type BannerProps} from "@terreno/ui";
import type React from "react";

export const BannerDemo = (props: Partial<BannerProps>): React.ReactElement => {
  return (
    <Banner
      buttonIconName="check"
      buttonOnClick={() => console.warn("clicked")}
      buttonText="Button Text"
      dismissible
      hasIcon
      id="bannerDemo1"
      text="Banner Text"
      {...props}
    />
  );
};
