// bunSetup stubs ./DateTimeActionSheet for the main test pass so field tests render a
// placeholder. This isolated pass runs the real component instead.
import {beforeEach, describe, expect, it, mock, spyOn} from "bun:test";
import {Picker} from "@react-native-picker/picker";
import {act, fireEvent} from "@testing-library/react-native";
import {DateTime} from "luxon";
import type React from "react";
import {TextInput} from "react-native";
import {Calendar} from "react-native-calendars";

import type {DateTimeActionSheetProps} from "../Common";
import {DateTimeActionSheet} from "../DateTimeActionSheet";
import {isMobileDevice} from "../MediaQuery";
import {renderWithTheme} from "../test-utils";

type CalendarHeaderProps = {addMonth: (num: number) => void; month: Date[]};

const setMobile = (mobile: boolean): void => {
  (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => mobile);
};

const renderSheet = (props: Partial<DateTimeActionSheetProps> = {}) => {
  const onChange = mock((_value: string) => {});
  const onDismiss = mock(() => {});
  const rendered = renderWithTheme(
    <DateTimeActionSheet
      onChange={onChange}
      onDismiss={onDismiss}
      timezone="UTC"
      type="datetime"
      value="2024-01-15T10:30:00.000Z"
      visible
      {...props}
    />
  );
  return {...rendered, onChange, onDismiss};
};

const pressDay = (root: ReturnType<typeof renderSheet>["root"], dateString: string): void => {
  const calendar = root.findByType(Calendar);
  act(() => {
    calendar.props.onDayPress({dateString});
  });
};

describe("DateTimeActionSheet", () => {
  beforeEach(() => {
    setMobile(false);
  });

  describe("date type", () => {
    it("sends the selected day and dismisses immediately", () => {
      const {onChange, onDismiss, root} = renderSheet({
        type: "date",
        value: "2024-01-15T00:00:00.000Z",
      });

      pressDay(root, "2024-02-20");

      expect(onChange).toHaveBeenCalledWith("2024-02-20");
      expect(onDismiss).toHaveBeenCalled();
    });

    it("marks the selected day in UTC", () => {
      const {root} = renderSheet({type: "date", value: "2024-01-15T00:00:00.000Z"});

      expect(root.findByType(Calendar).props.markedDates["2024-01-15"].selected).toBe(true);
    });

    it("saves the selected day as UTC midnight", async () => {
      const {getByText, onChange, onDismiss, root} = renderSheet({
        type: "date",
        value: "2024-01-15T00:00:00.000Z",
      });

      pressDay(root, "2024-02-20");
      onChange.mockClear();
      onDismiss.mockClear();
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(onChange).toHaveBeenCalledWith("2024-02-20T00:00:00.000Z");
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe("datetime type", () => {
    it("marks the selected day in the provided timezone", () => {
      const {root} = renderSheet({timezone: "America/Los_Angeles"});

      expect(root.findByType(Calendar).props.markedDates["2024-01-15"].selected).toBe(true);
    });

    it("marks the selected day in the local zone when no timezone is provided", () => {
      const {root} = renderSheet({timezone: undefined});

      expect(Object.keys(root.findByType(Calendar).props.markedDates)).toHaveLength(1);
    });

    it("saves the edited hour and minute in UTC", async () => {
      const {UNSAFE_getAllByType, getByText, onChange} = renderSheet();

      const [hourInput, minuteInput] = UNSAFE_getAllByType(TextInput);
      act(() => {
        fireEvent.changeText(hourInput, "9");
        fireEvent.changeText(minuteInput, "05");
      });
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(onChange).toHaveBeenCalledWith("2024-01-15T09:05:00.000Z");
    });

    it("converts a pm selection to a 24 hour value", async () => {
      const {getByText, onChange, UNSAFE_getAllByProps} = renderSheet();

      const amPmSelect = UNSAFE_getAllByProps({value: "am"}).find(
        (node) => typeof node.props.onChange === "function"
      );
      act(() => {
        amPmSelect?.props.onChange("pm");
      });
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(onChange).toHaveBeenCalledWith("2024-01-15T22:30:00.000Z");
    });

    it("treats 12am as midnight", async () => {
      const {getByText, onChange} = renderSheet({value: "2024-01-15T00:30:00.000Z"});

      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(onChange).toHaveBeenCalledWith("2024-01-15T00:30:00.000Z");
    });

    it("keeps 12pm as noon", async () => {
      const {getByText, onChange} = renderSheet({value: "2024-01-15T12:30:00.000Z"});

      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(onChange).toHaveBeenCalledWith("2024-01-15T12:30:00.000Z");
    });

    it("clears the value with the secondary button", async () => {
      const {getByText, onChange, onDismiss} = renderSheet();

      await act(async () => {
        fireEvent.press(getByText("Clear"));
      });

      expect(onChange).toHaveBeenCalledWith("");
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe("time type", () => {
    it("saves an edited time in UTC on the web time picker", async () => {
      const {UNSAFE_getAllByType, getByText, onChange} = renderSheet({type: "time"});

      const [hourInput] = UNSAFE_getAllByType(TextInput);
      act(() => {
        fireEvent.changeText(hourInput, "8");
      });
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(onChange).toHaveBeenCalledWith("2024-01-15T08:30:00.000Z");
    });

    it("flags out of range hour and minute entries", () => {
      const {UNSAFE_getAllByType} = renderSheet({type: "time"});

      const [hourInput, minuteInput] = UNSAFE_getAllByType(TextInput);
      act(() => {
        fireEvent.changeText(hourInput, "42");
        fireEvent.changeText(minuteInput, "99");
      });

      expect(UNSAFE_getAllByType(TextInput)[0].props.value).toBe("42");
      expect(UNSAFE_getAllByType(TextInput)[1].props.value).toBe("99");
    });

    it("focuses and blurs the time inputs", () => {
      const {UNSAFE_getAllByType} = renderSheet({type: "time"});

      const [hourInput] = UNSAFE_getAllByType(TextInput);
      act(() => {
        fireEvent(hourInput, "focus");
        fireEvent(hourInput, "blur");
      });

      expect(UNSAFE_getAllByType(TextInput)[0].props.value).toBe("10");
    });

    it("selects hour, minute, and meridiem with the native pickers", async () => {
      setMobile(true);
      const {getByText, onChange, root} = renderSheet({type: "time"});

      const [hourPicker, minutePicker, amPmPicker] = root.findAllByType(Picker);
      act(() => {
        hourPicker.props.onValueChange(4);
        minutePicker.props.onValueChange("45");
        amPmPicker.props.onValueChange("pm");
      });
      await act(async () => {
        fireEvent.press(getByText("Save"));
      });

      expect(onChange).toHaveBeenCalledWith("2024-01-15T16:45:00.000Z");
    });
  });

  describe("calendar header", () => {
    it("shifts the visible month and year", () => {
      const {root} = renderSheet({type: "date", value: "2024-01-15T00:00:00.000Z"});
      const CalendarHeader = root.findByType(Calendar).props
        .customHeader as React.ComponentType<CalendarHeaderProps>;
      const addMonth = mock((_num: number) => {});

      const {getByLabelText, getByText} = renderWithTheme(
        <CalendarHeader addMonth={addMonth} month={[new Date(2024, 1, 15)]} />
      );

      expect(getByText("Feb 2024")).toBeTruthy();
      fireEvent.press(getByLabelText("Previous year button"));
      fireEvent.press(getByLabelText("Previous month button"));
      fireEvent.press(getByLabelText("Next month button"));
      fireEvent.press(getByLabelText("Next year button"));

      expect(addMonth.mock.calls.map(([num]) => num)).toEqual([-12, -1, 1, 12]);
    });
  });

  describe("invalid input", () => {
    it("logs when the timezone cannot be determined", () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});
      mock.module("expo-localization", () => ({getCalendars: () => []}));

      try {
        renderSheet({timezone: undefined});
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
        mock.module("expo-localization", () => ({
          getCalendars: () => [{timeZone: "America/New_York"}],
        }));
      }
    });

    it("logs when the value is not a string", () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});

      try {
        renderSheet({value: 5 as unknown as string});
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it("warns and keeps the previous state for an unparseable value", () => {
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

      try {
        const {UNSAFE_getAllByType} = renderSheet({type: "time", value: "not-a-date"});
        expect(warnSpy).toHaveBeenCalled();
        expect(UNSAFE_getAllByType(TextInput)[0].props.value).toBe("0");
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("defaults to the current time when no value is provided", () => {
      const {UNSAFE_getAllByType} = renderSheet({type: "time", value: undefined});

      const currentHour = DateTime.now().setZone("UTC").hour % 12 || 12;
      expect(UNSAFE_getAllByType(TextInput)[0].props.value).toBe(String(currentHour));
    });
  });
});
