import {Page, type PageProps} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import React, {useCallback} from "react";

export interface AdminScreenPageProps extends PageProps {
  /**
   * Route to open when the back arrow is pressed. Defaults to `/admin`.
   * Pass the host `routeBase` when admin is mounted under a different prefix.
   */
  backHref?: string;
}

/**
 * Standard page shell for custom admin screens.
 *
 * Admin screens are reached from the sidebar, so they show a back arrow by default.
 * The arrow navigates to admin home rather than `router.back()` because sidebar
 * navigation does not always leave a reliable history entry on web.
 * Set `backButton={false}` only when the host provides equivalent navigation.
 */
export const AdminScreenPage: React.FC<AdminScreenPageProps> = ({
  backButton = true,
  backHref = "/admin",
  onBack,
  ...pageProps
}) => {
  const handleBack = useCallback((): void => {
    if (onBack) {
      onBack();
      return;
    }
    router.push((backHref || "/") as Href);
  }, [backHref, onBack]);

  return <Page backButton={backButton} onBack={handleBack} {...pageProps} />;
};
