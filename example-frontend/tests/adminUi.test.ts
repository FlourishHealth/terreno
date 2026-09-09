import {describe, expect, it} from "bun:test";
import type {Page} from "@playwright/test";
import {adminModelEntry, waitForAdminHome, waitForAdminTable} from "../e2e/helpers/adminUi";

interface FakeLocator {
  first: () => FakeLocator;
  or: (other: FakeLocator) => FakeLocator;
  waitFor: (opts: {state: string; timeout?: number}) => Promise<void>;
}

const createFakePage = (): {
  getByTestIdCalls: string[];
  page: Page;
  waitForCalls: Array<{state: string; timeout?: number}>;
} => {
  const getByTestIdCalls: string[] = [];
  const waitForCalls: Array<{state: string; timeout?: number}> = [];
  const locator: FakeLocator = {
    first: (): FakeLocator => locator,
    or: (_other: FakeLocator): FakeLocator => locator,
    waitFor: async (opts: {state: string; timeout?: number}): Promise<void> => {
      waitForCalls.push(opts);
    },
  };
  const page = {
    getByTestId: (testId: string): FakeLocator => {
      getByTestIdCalls.push(testId);
      return locator;
    },
  } as unknown as Page;
  return {getByTestIdCalls, page, waitForCalls};
};

describe("adminUi helpers", () => {
  it("chains model-card and grid test ids", (): void => {
    const {getByTestIdCalls, page} = createFakePage();
    const entry = adminModelEntry(page, "Todo");
    expect(entry).toBeTruthy();
    expect(getByTestIdCalls).toEqual([
      "admin-home-models-grid-Todo-clickable",
      "admin-model-card-Todo-clickable",
      "admin-home-models-grid-Todo",
      "admin-model-card-Todo",
    ]);
  });

  it("waits 15s for the Todo home entry", async (): Promise<void> => {
    const {waitForCalls, page} = createFakePage();
    await waitForAdminHome(page);
    expect(waitForCalls).toEqual([{state: "visible", timeout: 15_000}]);
  });

  it("waits 15s for the changelist create button", async (): Promise<void> => {
    const {getByTestIdCalls, waitForCalls, page} = createFakePage();
    await waitForAdminTable(page);
    expect(getByTestIdCalls).toEqual(["admin-create-button"]);
    expect(waitForCalls).toEqual([{state: "visible", timeout: 15_000}]);
  });
});
