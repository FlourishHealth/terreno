import {describe, expect, it} from "bun:test";

import {SimpleContent, useCombinedRefs} from "./ModalSheet";

describe("ModalSheet", () => {
  // ModalSheet uses react-native-modalize and react-native-portalize
  // which don't work in the test environment
  it.skip("renders correctly (skipped - uses react-native-modalize)", () => {
    expect(SimpleContent).toBeDefined();
  });

  it("SimpleContent is defined", () => {
    expect(SimpleContent).toBeDefined();
  });

  it("useCombinedRefs is defined", () => {
    expect(useCombinedRefs).toBeDefined();
    expect(typeof useCombinedRefs).toBe("function");
  });
});
