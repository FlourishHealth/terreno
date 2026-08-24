import {describe, it} from "bun:test";
import {assert} from "chai";

import {ADMIN_PAGE_PERMISSION, canOpenAdminPage, hasPermission} from "./usePermissions";

describe("canOpenAdminPage", () => {
  it("requires admin:access when a permissions object is present", () => {
    assert.isTrue(canOpenAdminPage({admin: false, permissions: {admin: ["access"]}}));
    assert.isTrue(hasPermission({admin: ["access", "runScripts"]}, ADMIN_PAGE_PERMISSION));
    assert.isFalse(canOpenAdminPage({admin: true, permissions: {}}));
    assert.isFalse(
      canOpenAdminPage({
        admin: true,
        permissions: {admin: ["runScripts"], adminTodo: ["read", "write"]},
      })
    );
  });

  it("falls back to the admin flag when RBAC permissions are absent", () => {
    assert.isTrue(canOpenAdminPage({admin: true}));
    assert.isFalse(canOpenAdminPage({admin: false}));
    assert.isFalse(canOpenAdminPage({}));
  });
});
