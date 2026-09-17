import {usePathname} from "expo-router";
import {useMemo} from "react";
import type {OrganizationSummary} from "./OrgDirectoryScreen";

/** Extract `/orgs/:orgId` from an admin pathname. */
export const organizationIdFromPath = (pathname: string): string | undefined => {
  const match = pathname.match(/\/orgs\/([^/]+)(?:\/|$)/);
  return match?.[1];
};

export const organizationMatchesRoute = (
  organization: OrganizationSummary | undefined,
  organizationId: string
): boolean => {
  if (!organization) {
    return false;
  }
  return String(organization._id) === String(organizationId);
};

/** Route-derived org id for `OrgContextProvider.initialOrganization`. */
export const useRouteOrganizationInitial = (): OrganizationSummary | undefined => {
  const pathname = usePathname();
  const organizationId = organizationIdFromPath(pathname);
  return useMemo((): OrganizationSummary | undefined => {
    if (!organizationId) {
      return undefined;
    }
    return {_id: organizationId, name: organizationId};
  }, [organizationId]);
};
