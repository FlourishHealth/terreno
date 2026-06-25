import {describe, expect, it} from "bun:test";

import {
  pickTestId,
  resolveDataTableRowTestId,
  resolveFieldTestIds,
  resolveModalTestIds,
  resolveTestId,
  toDomTestProps,
  toTestProps,
} from "./resolveTestId";

describe("pickTestId", () => {
  it("prefers testId over testID", () => {
    expect(pickTestId({testID: "old", testId: "new"})).toBe("new");
  });

  it("falls back to testID when testId is absent", () => {
    expect(pickTestId({testID: "legacy"})).toBe("legacy");
  });

  it("returns undefined when neither is set", () => {
    expect(pickTestId({})).toBeUndefined();
  });
});

describe("resolveTestId", () => {
  it("returns base when part is omitted", () => {
    expect(resolveTestId("login")).toBe("login");
  });

  it("joins base and part with a dot", () => {
    expect(resolveTestId("login", "email")).toBe("login.email");
    expect(resolveTestId("login.email", "input")).toBe("login.email.input");
  });

  it("returns undefined when base is absent", () => {
    expect(resolveTestId(undefined, "input")).toBeUndefined();
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

describe("resolveFieldTestIds", () => {
  it("applies dot-suffix defaults", () => {
    expect(resolveFieldTestIds("signup.email")).toEqual({
      error: "signup.email.error",
      helper: "signup.email.helper",
      input: "signup.email",
      label: "signup.email.label",
    });
  });

  it("allows testIds overrides", () => {
    expect(
      resolveFieldTestIds("signup.email", {
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

describe("resolveModalTestIds", () => {
  it("applies dot-suffix defaults", () => {
    expect(resolveModalTestIds("confirm-delete")).toEqual({
      dismiss: "confirm-delete.dismiss",
      primaryButton: "confirm-delete.primary",
      root: "confirm-delete",
      secondaryButton: "confirm-delete.secondary",
      title: "confirm-delete.title",
    });
  });
});

describe("resolveDataTableRowTestId", () => {
  it("appends row key to row test id base", () => {
    expect(resolveDataTableRowTestId("users-table.row", "abc123")).toBe("users-table.row-abc123");
  });

  it("returns undefined when base is absent", () => {
    expect(resolveDataTableRowTestId(undefined, "abc123")).toBeUndefined();
  });
});
