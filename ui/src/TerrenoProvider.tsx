import type React from "react";
import type {FC} from "react";

import type {IconRegistryMap} from "./Common";
import {IconRegistryProvider} from "./IconRegistry";
import {OpenAPIProvider} from "./OpenAPIContext";
import {Host} from "./PortalHost";
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

            const toastData = toastOptions?.data;
            const title =
              toastData?.title ??
              (typeof toastOptions?.message === "string" ? toastOptions.message : "");

            return <Toast {...toastData} onDismiss={handleDismiss} title={title} />;
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
