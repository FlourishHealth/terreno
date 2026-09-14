import {describe, it} from "bun:test";
import {assert} from "chai";

import {appStatements} from "./access";

describe("example-backend access statements", () => {
  it("declares admin-exposed models so superadmin * can list them", () => {
    assert.includeMembers([...appStatements.featureFlag], ["list", "read"]);
    assert.includeMembers([...appStatements.consentForm], ["list", "read"]);
    assert.includeMembers([...appStatements.consentResponse], ["list", "read"]);
    assert.deepEqual([...appStatements.adminAuditLog], ["list", "read"]);
    assert.deepEqual([...appStatements.adminMcpServiceToken], ["read", "write", "writeOwned"]);
    assert.includeMembers([...appStatements.todo], ["list", "read"]);
    assert.deepEqual([...appStatements.adminTodo], ["read", "write", "writeOwned"]);
    assert.deepEqual([...appStatements.adminUser], ["read", "write", "writeOwned"]);
    assert.includeMembers([...appStatements.adminScreen], ["showcase", "syncLab"]);
  });
});
