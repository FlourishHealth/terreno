import {describe, it} from "bun:test";
import {act} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {Text} from "react-native";
import {renderWithTheme} from "../../../ui/src/test-utils";
import {
  OrgContextProvider,
  organizationFromPath,
  organizationIdFromPath,
  organizationMatchesRoute,
  useOrgContext,
} from "./useOrgContext";

const OrgIdProbe: React.FC = () => {
  const {organizationId} = useOrgContext();
  return <Text testID="org-id">{organizationId ?? "none"}</Text>;
};

describe("useOrgContext", () => {
  it("derives organization context from admin organization paths", () => {
    assert.equal(organizationIdFromPath("/admin/orgs/org-alpha"), "org-alpha");
    assert.equal(organizationIdFromPath("/admin/orgs/org-alpha/members"), "org-alpha");
    assert.isUndefined(organizationFromPath("/admin/orgs"));
    assert.deepEqual(organizationFromPath("/admin/orgs/org-alpha"), {
      _id: "org-alpha",
      name: "org-alpha",
    });
  });

  it("matches loaded organizations to the active route id", () => {
    assert.isTrue(organizationMatchesRoute({_id: "org-1", name: "Acme"}, "org-1"));
    assert.isFalse(organizationMatchesRoute({_id: "org-1", name: "Acme"}, "org-2"));
    assert.isFalse(organizationMatchesRoute(undefined, "org-1"));
  });

  it("throws outside OrgContextProvider", () => {
    assert.throws(() => {
      renderWithTheme(<OrgIdProbe />);
    }, /useOrgContext must be used inside OrgContextProvider/);
  });

  it("keeps the mounted organization when initialOrganization is omitted later", () => {
    const screen = renderWithTheme(
      <OrgContextProvider initialOrganization={{_id: "org-1", name: "Acme"}}>
        <OrgIdProbe />
      </OrgContextProvider>
    );
    assert.equal(screen.getByTestId("org-id").props.children, "org-1");

    act(() => {
      screen.rerender(
        <OrgContextProvider>
          <OrgIdProbe />
        </OrgContextProvider>
      );
    });
    assert.equal(screen.getByTestId("org-id").props.children, "org-1");
  });

  it("ignores a later initialOrganization with the same id", () => {
    const screen = renderWithTheme(
      <OrgContextProvider initialOrganization={{_id: "org-1", name: "Acme"}}>
        <OrgIdProbe />
      </OrgContextProvider>
    );

    act(() => {
      screen.rerender(
        <OrgContextProvider initialOrganization={{_id: "org-1", name: "Renamed"}}>
          <OrgIdProbe />
        </OrgContextProvider>
      );
    });
    assert.equal(screen.getByTestId("org-id").props.children, "org-1");
  });

  it("syncs context when the route-derived organization id changes", () => {
    const screen = renderWithTheme(
      <OrgContextProvider initialOrganization={{_id: "org-1", name: "Acme"}}>
        <OrgIdProbe />
      </OrgContextProvider>
    );

    act(() => {
      screen.rerender(
        <OrgContextProvider initialOrganization={{_id: "org-2", name: "Other"}}>
          <OrgIdProbe />
        </OrgContextProvider>
      );
    });
    assert.equal(screen.getByTestId("org-id").props.children, "org-2");
  });
});
