import {describe, it} from "bun:test";
import {assert} from "chai";

import {organizationSettingsSchema} from "./organizationSettings";

describe("organizationSettingsSchema", () => {
  it("declares an optional timezone string", () => {
    const timezone = organizationSettingsSchema.path("timezone");
    assert.equal(timezone?.instance, "String");
    assert.isNotTrue(Boolean(timezone?.isRequired));
  });
});
