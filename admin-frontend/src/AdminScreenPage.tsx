import {Page, type PageProps} from "@terreno/ui";
import React from "react";

export interface AdminScreenPageProps extends PageProps {}

/**
 * Standard page shell for custom admin screens.
 *
 * Admin screens are reached from the sidebar, so they show a back arrow by default.
 * Set `backButton={false}` only when the host provides equivalent navigation.
 */
export const AdminScreenPage: React.FC<AdminScreenPageProps> = ({
  backButton = true,
  ...pageProps
}) => {
  return <Page backButton={backButton} {...pageProps} />;
};
