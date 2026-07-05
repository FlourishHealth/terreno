import {request} from "@playwright/test";
import {ADMIN_USER} from "../fixtures/testUsers";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

interface FlagRecord {
  _id?: string;
  key?: string;
  enabled?: boolean;
}

/**
 * Toggle the backend "use-syncdb" feature flag via the admin feature-flags API,
 * creating the flag first when the database was never seeded. This is how the
 * syncdb e2e suite turns the local-first data layer on and off at runtime
 * without rebuilding the web bundle (see the note at the top of helpers/syncdbSuite.ts).
 */
export const setSyncDbFlag = async (enabled: boolean): Promise<void> => {
  const apiContext = await request.newContext({baseURL: API_URL});
  try {
    const loginRes = await apiContext.post("/auth/login", {
      data: {email: ADMIN_USER.email, password: ADMIN_USER.password},
    });
    if (!loginRes.ok()) {
      throw new Error(`setSyncDbFlag: admin login failed with status ${loginRes.status()}`);
    }
    const loginData = (await loginRes.json()) as {data?: {token?: string}; token?: string};
    const token = loginData?.data?.token ?? loginData?.token ?? "";
    if (!token) {
      throw new Error("setSyncDbFlag: no token in admin login response");
    }
    const headers = {authorization: `Bearer ${token}`};

    const listRes = await apiContext.get("/feature-flags/flags", {headers});
    if (!listRes.ok()) {
      throw new Error(`setSyncDbFlag: flag list failed with status ${listRes.status()}`);
    }
    const listJson = (await listRes.json()) as {data?: FlagRecord[]};
    const existing = (listJson.data ?? []).find((flag) => flag.key === "use-syncdb");

    if (!existing?._id) {
      const createRes = await apiContext.post("/feature-flags/flags", {
        data: {
          defaultVariant: "off",
          description: "Use the @terreno/syncdb local-first data layer for the Todos screen",
          enabled,
          key: "use-syncdb",
          name: "Use SyncDB",
          rolloutPercentage: 100,
          type: "boolean",
        },
        headers,
      });
      if (!createRes.ok()) {
        throw new Error(
          `setSyncDbFlag: flag create failed with status ${createRes.status()}: ${await createRes.text()}`
        );
      }
      return;
    }

    if (existing.enabled === enabled) {
      return;
    }
    // The PATCH schema requires key and name alongside the changed field.
    const patchRes = await apiContext.patch(`/feature-flags/flags/${existing._id}`, {
      data: {enabled, key: "use-syncdb", name: "Use SyncDB"},
      headers,
    });
    if (!patchRes.ok()) {
      throw new Error(
        `setSyncDbFlag: flag patch failed with status ${patchRes.status()}: ${await patchRes.text()}`
      );
    }
  } finally {
    await apiContext.dispose();
  }
};
