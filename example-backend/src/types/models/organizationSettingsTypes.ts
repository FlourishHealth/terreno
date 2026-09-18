export interface ExampleOrganizationSettings {
  timezone?: string;
}

declare module "@terreno/api" {
  interface OrganizationSettings extends ExampleOrganizationSettings {}
}
