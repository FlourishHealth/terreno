import {describe, it} from "bun:test";
import {assert} from "chai";

import {isAuditLogModel} from "./isAuditLogModel";

describe("isAuditLogModel", () => {
  it("matches AuditEvent, leftover AdminAuditLog, and audit route paths", () => {
    assert.isTrue(isAuditLogModel({name: "AuditEvent", routePath: "/admin/audit-events"}));
    assert.isTrue(isAuditLogModel({name: "AdminAuditLog", routePath: "/admin/widgets"}));
    assert.isTrue(isAuditLogModel({name: "Log", routePath: "/admin/audit-log"}));
    assert.isTrue(isAuditLogModel({name: "Log", routePath: "/admin/audit-events"}));
    assert.isFalse(isAuditLogModel({name: "Todo", routePath: "/admin/todos"}));
  });
});
