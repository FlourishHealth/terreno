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

export const OrgContextProvider: React.FC<OrgContextProviderProps> = ({
  children,
  initialOrganization,
  onOrganizationChange,
}) => {
  const [organization, setOrganization] = useState<OrganizationSummary | undefined>(
    initialOrganization
  );
  // Hosts that pass a route-derived org must keep context aligned after navigation.
  useEffect(() => {
    if (!initialOrganization) {
      return;
    }
    if (organization?._id === initialOrganization._id) {
      return;
    }
    setOrganization(initialOrganization);
  }, [initialOrganization, organization?._id]);
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
