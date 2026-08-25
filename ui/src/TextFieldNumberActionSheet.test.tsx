import {describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import {DateTime} from "luxon";
import {createRef} from "react";
import type {ReactTestInstance} from "react-test-renderer";

import type {ActionSheet} from "./ActionSheet";
import {NumberPickerActionSheet} from "./TextFieldNumberActionSheet";
import {renderWithTheme} from "./test-utils";

describe("TextFieldNumberActionSheet date picker", () => {
  it("emits UTC ISO so the stored value can be parsed with fromISO", () => {
    const actionSheetRef = createRef<ActionSheet>();
    const handleChange = mock((_val: string) => {});
    const iso = "2024-06-15T12:00:00.000Z";
    const {UNSAFE_getByProps} = renderWithTheme(
      <NumberPickerActionSheet
        actionSheetRef={actionSheetRef}
        mode="date"
        onChange={handleChange}
        value={iso}
      />
    );
    const picker = UNSAFE_getByProps({testID: "dateTimePicker"});
    const next = DateTime.fromISO("2024-07-01T18:30:00.000Z", {zone: "utc"}).toJSDate();
    act(() => {
      (picker as ReactTestInstance).props.onChange({}, next);
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
    const emitted = handleChange.mock.calls[0]?.[0] as string;
    expect(DateTime.fromISO(emitted).isValid).toBe(true);
    expect(DateTime.fromISO(emitted).toUTC().toISO()).toBe("2024-07-01T18:30:00.000Z");
  });
});
