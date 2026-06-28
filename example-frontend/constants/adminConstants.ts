import type {AdminCustomScreen} from "@terreno/admin-frontend";

/** Expo Router base for admin screens (must match `app/admin/` URL prefix). */
export const ADMIN_ROUTE = "/admin";

/** Merged into {@link AdminShell} and {@link AdminModelList} so sidebar + tool cards match. */
export const ADMIN_CUSTOM_SCREENS: AdminCustomScreen[] = [
  {
    description: "View AI request logs and usage",
    displayName: "AI Admin",
    name: "ai-admin",
  },
];
