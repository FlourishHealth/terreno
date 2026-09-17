import {describe, expect, it} from "bun:test";
import {COMMS_ADMIN_WIDGETS} from "../comms/CommsDashboardScreenWidget";
import {JOBS_ADMIN_WIDGETS} from "../jobs/JobsDashboardScreenWidget";
import {JOBS_HOME_WIDGETS, JobsHomeWidget} from "../jobs/JobsHomeWidget";
import {AI_ADMIN_WIDGETS} from "./AIRequestsScreenWidget";
import {CONSENT_ADMIN_WIDGETS} from "./consentWidgets";
import {DOCUMENT_STORAGE_ADMIN_WIDGETS} from "./DocumentsScreenWidget";
import {
  FEATURE_FLAGS_ADMIN_WIDGETS,
  FeatureFlagsOverridesWidget,
} from "./FeatureFlagsOverridesWidget";

describe("plugin admin widget registries", () => {
  it("exports feature flags home widgets by contribution id", () => {
    expect(FEATURE_FLAGS_ADMIN_WIDGETS["feature-flags-overrides"]).toBe(
      FeatureFlagsOverridesWidget
    );
  });

  it("exports consent field widgets by configured widget id", () => {
    expect(Object.keys(CONSENT_ADMIN_WIDGETS).sort()).toEqual([
      "checkbox-list",
      "locale-content",
      "locale-default",
    ]);
  });

  it("exports documents, AI request, comms, and jobs screen widgets by custom screen name", () => {
    expect(DOCUMENT_STORAGE_ADMIN_WIDGETS.documents).toBeDefined();
    expect(AI_ADMIN_WIDGETS["ai-requests"]).toBeDefined();
    expect(COMMS_ADMIN_WIDGETS.comms).toBeDefined();
    expect(JOBS_ADMIN_WIDGETS.jobs).toBeDefined();
  });

  it("exports jobs home widgets by contribution id", () => {
    expect(JOBS_HOME_WIDGETS.jobs).toBe(JobsHomeWidget);
  });
});
