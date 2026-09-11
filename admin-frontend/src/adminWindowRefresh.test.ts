import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import {
  clearAdminWindowMembershipStale,
  isAdminWindowMembershipStale,
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

    assert.isFalse(isAdminWindowMembershipStale("todos"));
    markAdminWindowMembershipStale({collection: "todos"});
    assert.isTrue(isAdminWindowMembershipStale("todos"));
    assert.equal(notifications, 1);

    markAdminWindowMembershipStale({collection: "todos"});
    assert.equal(notifications, 1);

    clearAdminWindowMembershipStale({collection: "todos"});
    assert.isFalse(isAdminWindowMembershipStale("todos"));
    assert.equal(notifications, 2);

    clearAdminWindowMembershipStale({collection: "todos"});
    assert.equal(notifications, 2);

    unsubscribe();
    markAdminWindowMembershipStale({collection: "todos"});
    assert.equal(notifications, 2);
  });

  it("ignores an empty collection and treats an undefined collection as fresh", () => {
    markAdminWindowMembershipStale({collection: ""});
    assert.isFalse(isAdminWindowMembershipStale(""));
    assert.isFalse(isAdminWindowMembershipStale(undefined));
  });

  it("keeps collections independent", () => {
    markAdminWindowMembershipStale({collection: "todos"});
    assert.isFalse(isAdminWindowMembershipStale("users"));
    clearAdminWindowMembershipStale({collection: "users"});
    assert.isTrue(isAdminWindowMembershipStale("todos"));
  });
});
