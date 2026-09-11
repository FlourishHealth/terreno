import {describe, expect, it} from "bun:test";
import {
  createTextFieldOscillationState,
  recordTextFieldOscillation,
  shouldSuppressTextFieldOscillation,
  TEXT_FIELD_OSCILLATION_WINDOW_MS,
} from "./textFieldOscillationGuard";

describe("textFieldOscillationGuard", () => {
  it("suppresses rapid A→B→A synthetic alternation", () => {
    const state = createTextFieldOscillationState();
    const valueA = "reachthreshold";
    const valueB = "reach threshold";
    let now = 1_000;

    expect(
      shouldSuppressTextFieldOscillation({currentValue: valueA, now, state, text: valueB})
    ).toBe(false);
    recordTextFieldOscillation({currentValue: valueA, now, state, text: valueB});

    now += 10;
    expect(
      shouldSuppressTextFieldOscillation({currentValue: valueB, now, state, text: valueA})
    ).toBe(true);

    now += 10;
    expect(
      shouldSuppressTextFieldOscillation({currentValue: valueB, now, state, text: valueA})
    ).toBe(true);
  });

  it("allows ordinary backspace and retype after the oscillation window", () => {
    const state = createTextFieldOscillationState();
    const hello = "hello";
    const hell = "hell";
    let now = 2_000;

    expect(shouldSuppressTextFieldOscillation({currentValue: hello, now, state, text: hell})).toBe(
      false
    );
    recordTextFieldOscillation({currentValue: hello, now, state, text: hell});

    now += TEXT_FIELD_OSCILLATION_WINDOW_MS + 1;
    expect(shouldSuppressTextFieldOscillation({currentValue: hell, now, state, text: hello})).toBe(
      false
    );
  });

  it("allows forward typing that does not revisit a recent prior value", () => {
    const state = createTextFieldOscillationState();
    let now = 3_000;

    expect(shouldSuppressTextFieldOscillation({currentValue: "h", now, state, text: "he"})).toBe(
      false
    );
    recordTextFieldOscillation({currentValue: "h", now, state, text: "he"});

    now += 5;
    expect(shouldSuppressTextFieldOscillation({currentValue: "he", now, state, text: "hel"})).toBe(
      false
    );
  });
});
