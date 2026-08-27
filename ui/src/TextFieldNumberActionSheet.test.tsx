import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {assert} from "chai";
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

  it("ignores changes without a date and changes that produce no ISO string", () => {
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getByProps} = renderWithTheme(
      <NumberPickerActionSheet
        actionSheetRef={createRef<ActionSheet>()}
        mode="time"
        onChange={handleChange}
        value="2024-06-15T12:00:00.000Z"
      />
    );
    const picker = UNSAFE_getByProps({testID: "dateTimePicker"}) as ReactTestInstance;
    act(() => {
      picker.props.onChange({}, undefined);
      picker.props.onChange({}, new Date(Number.NaN));
    });
    assert.equal(handleChange.mock.calls.length, 0);
  });

  it("falls back to now when the value is missing or unparseable", () => {
    const before = DateTime.now().toMillis();
    const renderWith = (value?: string): number => {
      const {UNSAFE_getByProps} = renderWithTheme(
        <NumberPickerActionSheet
          actionSheetRef={createRef<ActionSheet>()}
          mode="date"
          onChange={() => {}}
          value={value}
        />
      );
      const picker = UNSAFE_getByProps({testID: "dateTimePicker"}) as ReactTestInstance;
      return (picker.props.value as Date).getTime();
    };

    for (const value of [undefined, "not-a-date"]) {
      const millis = renderWith(value);
      assert.isAtLeast(millis, before);
      assert.isAtMost(millis, DateTime.now().toMillis());
    }
  });

  it("closes the action sheet when Save is pressed", async () => {
    const setModalVisible = mock((_visible: boolean) => {});
    const actionSheetRef = createRef<ActionSheet>();
    const {getByText} = renderWithTheme(
      <NumberPickerActionSheet
        actionSheetRef={actionSheetRef}
        mode="date"
        onChange={() => {}}
        value="2024-06-15T12:00:00.000Z"
      />
    );
    const sheet = actionSheetRef.current;
    if (!sheet) {
      throw new Error("expected the action sheet ref to be attached after render");
    }
    sheet.setModalVisible = setModalVisible;
    await act(async () => {
      fireEvent.press(getByText("Save"));
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    await waitFor(() => {
      assert.deepEqual(setModalVisible.mock.calls, [[false]]);
    });
  });
});
