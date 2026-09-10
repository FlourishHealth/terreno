// noExplicitAny: test fake captures dynamic RTK endpoint definitions.
// biome-ignore-all lint/suspicious/noExplicitAny: test-only RTK API double
import {describe, expect, it} from "bun:test";
import {Button} from "@terreno/ui";
import {act, fireEvent} from "@testing-library/react-native";
import React, {useCallback} from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {OrganizationSummary} from "./orgs/OrgDirectoryScreen";
import {OrgContextProvider, useOrgContext} from "./orgs/useOrgContext";
import type {AdminApi} from "./types";
import {useAdminApi} from "./useAdminApi";

interface EndpointDefinition {
  query: (args: unknown) => Record<string, unknown>;
}

const captured: Record<string, EndpointDefinition> = {};
const build = {
  mutation: (definition: EndpointDefinition): EndpointDefinition => definition,
  query: (definition: EndpointDefinition): EndpointDefinition => definition,
};
const hookApi = {
  useAdminList_FoodQuery: () => ({data: {data: []}}),
};
const api = {
  enhanceEndpoints: () => ({
    injectEndpoints: ({
      endpoints,
    }: {
      endpoints: (builder: unknown) => Record<string, EndpointDefinition>;
    }) => {
      Object.assign(captured, endpoints(build));
      return hookApi;
    },
  }),
} as unknown as AdminApi;

const secondOrganization: OrganizationSummary = {_id: "org-2", name: "Second"};

const Probe: React.FC = () => {
  const {selectOrganization} = useOrgContext();
  const {useListQuery} = useAdminApi(api, "/admin/foods", "Food");
  useListQuery({});
  const handleSwitch = useCallback((): void => {
    selectOrganization(secondOrganization);
  }, [selectOrganization]);
  return <Button onClick={handleSwitch} testID="switch-org" text="Switch" />;
};

describe("useAdminApi organization context", () => {
  it("updates X-Organization-Id after switching organizations", async () => {
    const screen = renderWithTheme(
      <OrgContextProvider initialOrganization={{_id: "org-1", name: "First"}}>
        <Probe />
      </OrgContextProvider>
    );
    expect(captured.adminList_Food.query({}).headers).toEqual({
      "X-Organization-Id": "org-1",
    });

    await act(async () => {
      fireEvent(screen.getByTestId("switch-org"), "click");
    });
    expect(captured.adminList_Food.query({}).headers).toEqual({
      "X-Organization-Id": "org-2",
    });
  });
});
