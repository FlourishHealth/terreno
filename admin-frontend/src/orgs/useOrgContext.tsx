import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import type {OrganizationSummary} from "./OrgDirectoryScreen";

export interface OrgContextValue {
  organization?: OrganizationSummary;
  organizationId?: string;
  selectOrganization: (organization: OrganizationSummary) => void;
}

export interface OrgContextProviderProps {
  children: React.ReactNode;
  initialOrganization?: OrganizationSummary;
  onOrganizationChange?: (organization: OrganizationSummary) => void;
}

const OrgContext = createContext<OrgContextValue | null>(null);

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

/** Build the route-derived value for `OrgContextProvider.initialOrganization`. */
export const organizationFromPath = (pathname: string): OrganizationSummary | undefined => {
  const organizationId = organizationIdFromPath(pathname);
  if (!organizationId) {
    return undefined;
  }
  return {_id: organizationId, name: organizationId};
};

export const OrgContextProvider: React.FC<OrgContextProviderProps> = ({
  children,
  initialOrganization,
  onOrganizationChange,
}) => {
  const [organization, setOrganization] = useState<OrganizationSummary | undefined>(
    initialOrganization
  );
  // Hosts pass route-derived org ids; sync only when the route id changes, not when
  // OrgSwitcher has already moved context ahead of the URL during navigation.
  useEffect(() => {
    if (!initialOrganization) {
      return;
    }
    setOrganization((current) => {
      if (current?._id === initialOrganization._id) {
        return current;
      }
      return initialOrganization;
    });
  }, [initialOrganization]);
  const selectOrganization = useCallback(
    (nextOrganization: OrganizationSummary): void => {
      setOrganization(nextOrganization);
      onOrganizationChange?.(nextOrganization);
    },
    [onOrganizationChange]
  );
  const value = useMemo(
    (): OrgContextValue => ({
      organization,
      organizationId: organization?._id,
      selectOrganization,
    }),
    [organization, selectOrganization]
  );
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};

export const useOptionalOrgContext = (): OrgContextValue | null => useContext(OrgContext);

export const useOrgContext = (): OrgContextValue => {
  const context = useOptionalOrgContext();
  if (!context) {
    throw new Error("useOrgContext must be used inside OrgContextProvider");
  }
  return context;
};
