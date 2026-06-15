import type React from "react";
import type {FC} from "react";
import {Host} from "react-native-portalize";

import type {IconRegistryMap} from "./Common";
import {IconRegistryProvider} from "./IconRegistry";
import {OpenAPIProvider} from "./OpenAPIContext";
import {ThemeProvider} from "./Theme";
import {Toast} from "./Toast";
import {ToastProvider} from "./ToastNotifications";

export const TerrenoProvider: FC<{
  children: React.ReactNode;
  openAPISpecUrl?: string;
  /**
   * Custom icons to register, keyed by icon name. Registered names take
   * precedence over FontAwesome glyphs and are usable anywhere an `iconName`
   * is accepted (Icon, Button, IconButton, fields, etc.).
   */
  icons?: IconRegistryMap;
}> = ({children, openAPISpecUrl, icons}) => {
  return (
    <ThemeProvider>
      <IconRegistryProvider icons={icons}>
        <ToastProvider
          animationDuration={250}
          animationType="slide-in"
          duration={50000}
          offset={50}
          placement="bottom"
          renderToast={(toastOptions) => {
            const dataOnDismiss = toastOptions?.data?.onDismiss;
            const providerOnHide = toastOptions?.onHide;
            const handleDismiss = () => {
              dataOnDismiss?.();
              providerOnHide?.();
            };

            return <Toast {...toastOptions?.data} onDismiss={handleDismiss} />;
          }}
          swipeEnabled
        >
          <OpenAPIProvider specUrl={openAPISpecUrl}>
            <Host>{children}</Host>
          </OpenAPIProvider>
        </ToastProvider>
      </IconRegistryProvider>
    </ThemeProvider>
  );
};
