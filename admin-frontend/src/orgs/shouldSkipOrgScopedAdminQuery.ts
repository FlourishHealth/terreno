export const shouldSkipOrgScopedAdminQuery = ({
  organizationId,
  organizationScoped,
}: {
  organizationId?: string;
  organizationScoped?: boolean;
}): boolean => organizationScoped === true && !organizationId;
