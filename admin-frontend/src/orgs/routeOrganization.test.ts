import {describe, expect, it} from "bun:test";
import {organizationIdFromPath, organizationMatchesRoute} from "./routeOrganization";

describe("routeOrganization", () => {
  it("extracts organization ids from admin org routes", () => {
    expect(organizationIdFromPath("/admin/orgs/org-alpha")).toBe("org-alpha");
    expect(organizationIdFromPath("/admin/orgs/org-alpha/members")).toBe("org-alpha");
    expect(organizationIdFromPath("/admin/orgs")).toBeUndefined();
    expect(organizationIdFromPath("/admin")).toBeUndefined();
  });

  it("matches loaded organizations to the active route id", () => {
    expect(organizationMatchesRoute({_id: "org-1", name: "Acme"}, "org-1")).toBe(true);
    expect(organizationMatchesRoute({_id: "org-1", name: "Acme"}, "org-2")).toBe(false);
    expect(organizationMatchesRoute(undefined, "org-1")).toBe(false);
  });
});
