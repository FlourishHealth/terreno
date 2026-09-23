import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import {
  clearAdminWindowMembershipStale,
  getAdminWindowMembershipStale,
  markAdminWindowMembershipStale,
  resetAdminWindowRefreshForTests,
  subscribeAdminWindowRefresh,
} from "./adminWindowRefresh";

describe("adminWindowRefresh", () => {
  beforeEach(() => {
    resetAdminWindowRefreshForTests();
  });

  it("flags and clears a collection, notifying subscribers once per change", () => {
    let notifications = 0;
    const unsubscribe = subscribeAdminWindowRefresh(() => {
      notifications += 1;
    });

    assert.isUndefined(getAdminWindowMembershipStale("todos"));
    markAdminWindowMembershipStale({collection: "todos"});
    assert.deepEqual(getAdminWindowMembershipStale("todos"), {});
    assert.equal(notifications, 1);

    markAdminWindowMembershipStale({collection: "todos"});
    assert.equal(notifications, 1);

    clearAdminWindowMembershipStale({collection: "todos"});
    assert.isUndefined(getAdminWindowMembershipStale("todos"));
    assert.equal(notifications, 2);

    clearAdminWindowMembershipStale({collection: "todos"});
    assert.equal(notifications, 2);

    unsubscribe();
    markAdminWindowMembershipStale({collection: "todos"});
    assert.equal(notifications, 2);
  });

  it("keeps a stable entry reference so it can back useSyncExternalStore", () => {
    markAdminWindowMembershipStale({awaitId: "todo-9", collection: "todos"});
    const first = getAdminWindowMembershipStale("todos");
    assert.deepEqual(first, {awaitId: "todo-9"});
    markAdminWindowMembershipStale({awaitId: "todo-9", collection: "todos"});
    assert.strictEqual(getAdminWindowMembershipStale("todos"), first);

    markAdminWindowMembershipStale({awaitId: "todo-10", collection: "todos"});
    assert.deepEqual(getAdminWindowMembershipStale("todos"), {awaitId: "todo-10"});
  });

  it("ignores an empty collection and treats an undefined collection as fresh", () => {
    markAdminWindowMembershipStale({collection: ""});
    assert.isUndefined(getAdminWindowMembershipStale(""));
    assert.isUndefined(getAdminWindowMembershipStale(undefined));
  });

  it("keeps collections independent", () => {
    markAdminWindowMembershipStale({collection: "todos"});
    assert.isUndefined(getAdminWindowMembershipStale("users"));
    clearAdminWindowMembershipStale({collection: "users"});
    assert.deepEqual(getAdminWindowMembershipStale("todos"), {});
  });
});
