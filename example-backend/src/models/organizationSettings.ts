import {createOrganizationSettingsSchema} from "@terreno/api";

export const organizationSettingsSchema = createOrganizationSettingsSchema({
  timezone: {
    description: "IANA timezone used for organization-local dates",
    type: String,
  },
});
