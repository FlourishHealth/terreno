import type {AdminHomeConfig} from "@terreno/admin-backend";

/** Admin home layout shared by `server.ts` and integration tests. */
export const exampleAdminHome: AdminHomeConfig = {
  slots: {
    contentTop: [],
    main: ["modelStats"],
    navGlobal: ["scriptRunner", "feature-flags-overrides"],
    sidebar: ["versionConfig", "jobs", "recentActivity"],
  },
  title: "Example administration",
};
