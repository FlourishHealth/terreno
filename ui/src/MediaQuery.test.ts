import {describe, it} from "bun:test";
import {assert} from "chai";

import {getBreakpointForWidth, isBreakpointAtLeast} from "./ResponsiveBreakpoint";

describe("MediaQuery", () => {
  it("keeps exact responsive breakpoint boundaries", () => {
    assert.equal(getBreakpointForWidth(575), "xs");
    assert.equal(getBreakpointForWidth(576), "sm");
    assert.equal(getBreakpointForWidth(767), "sm");
    assert.equal(getBreakpointForWidth(768), "md");
    assert.equal(getBreakpointForWidth(1311), "md");
    assert.equal(getBreakpointForWidth(1312), "lg");
  });

  it("compares breakpoints without reading Dimensions", () => {
    assert.isFalse(isBreakpointAtLeast({breakpoint: "xs", minimum: "sm"}));
    assert.isTrue(isBreakpointAtLeast({breakpoint: "sm", minimum: "sm"}));
    assert.isTrue(isBreakpointAtLeast({breakpoint: "lg", minimum: "md"}));
  });
});
