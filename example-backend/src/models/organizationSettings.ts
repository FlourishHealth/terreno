import {createOrganizationSettingsSchema} from "@terreno/api";
import type {ExampleOrganizationSettings} from "../types/models/organizationSettingsTypes";

const organizationSettingsDefinition: {
  [K in keyof ExampleOrganizationSettings]-?: {
    description: string;
    type: StringConstructor;
  };
} = {
  timezone: {
    description: "IANA timezone used for organization-local dates",
    type: String,
  },
};

export const organizationSettingsSchema = createOrganizationSettingsSchema(
  organizationSettingsDefinition
);
