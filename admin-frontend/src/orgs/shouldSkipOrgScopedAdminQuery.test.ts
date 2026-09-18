import {describe, expect, it} from "bun:test";
import {shouldSkipOrgScopedAdminQuery} from "./shouldSkipOrgScopedAdminQuery";

describe("shouldSkipOrgScopedAdminQuery", () => {
  it("skips when the model is org-scoped and no organization is selected", () => {
    expect(
      shouldSkipOrgScopedAdminQuery({organizationId: undefined, organizationScoped: true})
    ).toBe(true);
  });

  it("does not skip when organization context is present", () => {
    expect(shouldSkipOrgScopedAdminQuery({organizationId: "org-1", organizationScoped: true})).toBe(
      false
    );
  });

  it("does not skip for non-org-scoped models", () => {
    expect(
      shouldSkipOrgScopedAdminQuery({organizationId: undefined, organizationScoped: false})
    ).toBe(false);
  });
});
