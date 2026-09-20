/**
 * App-defined organization settings. Augment this interface in the host app:
 *
 * ```ts
 * declare module "@terreno/admin-frontend" {
 *   interface OrganizationSettings {
 *     timezone?: string;
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: Declaration merging for consumer settings.
export interface OrganizationSettings {}

/** Read typed settings from an organization payload. */
export const organizationSettingsOf = <
  TSettings extends OrganizationSettings = OrganizationSettings,
>(organization: {
  settings?: TSettings | null;
}): TSettings => {
  return (organization.settings ?? {}) as TSettings;
};
