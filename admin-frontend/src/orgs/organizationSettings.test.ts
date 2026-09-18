import {describe, it} from "bun:test";
import {assert} from "chai";

import {organizationSettingsOf} from "./organizationSettings";

describe("organizationSettingsOf", () => {
  it("returns {} when settings are missing and the stored object when present", () => {
    assert.deepEqual(organizationSettingsOf({}), {});
    assert.deepEqual(organizationSettingsOf({settings: {timezone: "UTC"}}), {timezone: "UTC"});
  });
});
