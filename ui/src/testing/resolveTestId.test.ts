import {describe, expect, it} from "bun:test";

import {
  resolveDataTableRowTestID,
  resolveFieldTestIDs,
  resolveModalTestIDs,
  resolveTestID,
  toDomTestProps,
  toTestProps,
} from "./resolveTestId";

describe("resolveTestID", () => {
  it("returns base when part is omitted", () => {
    expect(resolveTestID("login")).toBe("login");
  });

  it("joins base and part with a dot", () => {
    expect(resolveTestID("login", "email")).toBe("login.email");
    expect(resolveTestID("login.email", "input")).toBe("login.email.input");
  });

  it("returns undefined when base is absent", () => {
    expect(resolveTestID(undefined, "input")).toBeUndefined();
  });
});

describe("toTestProps", () => {
  it("returns testID for React Native components", () => {
    expect(toTestProps("submit")).toEqual({testID: "submit"});
  });

  it("returns empty object when id is absent", () => {
    expect(toTestProps(undefined)).toEqual({});
  });
});

describe("toDomTestProps", () => {
  it("returns data-testid for DOM elements", () => {
    expect(toDomTestProps("submit")).toEqual({"data-testid": "submit"});
  });
});

describe("resolveFieldTestIDs", () => {
  it("applies dot-suffix defaults", () => {
    expect(resolveFieldTestIDs("signup.email")).toEqual({
      error: "signup.email.error",
      helper: "signup.email.helper",
      input: "signup.email",
      label: "signup.email.label",
    });
  });

  it("allows testIDs overrides", () => {
    expect(
      resolveFieldTestIDs("signup.email", {
        input: "custom-input",
        label: "custom-label",
      })
    ).toEqual({
      error: "signup.email.error",
      helper: "signup.email.helper",
      input: "custom-input",
      label: "custom-label",
    });
  });
});

describe("resolveModalTestIDs", () => {
  it("applies dot-suffix defaults", () => {
    expect(resolveModalTestIDs("confirm-delete")).toEqual({
      dismiss: "confirm-delete.dismiss",
      primaryButton: "confirm-delete.primary",
      root: "confirm-delete",
      secondaryButton: "confirm-delete.secondary",
      title: "confirm-delete.title",
    });
  });
});

describe("resolveDataTableRowTestID", () => {
  it("appends row key to row test id base", () => {
    expect(resolveDataTableRowTestID("users-table.row", "abc123")).toBe("users-table.row-abc123");
  });

  it("returns undefined when base is absent", () => {
    expect(resolveDataTableRowTestID(undefined, "abc123")).toBeUndefined();
  });
});
