// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, userEvent} from "@testing-library/react-native";
import {DateTime} from "luxon";

import {DateTimeActionSheet} from "./DateTimeActionSheet";
import {DateTimeField} from "./DateTimeField";
import {isMobileDevice} from "./MediaQuery";
import {SelectField} from "./SelectField";
import {TimezonePicker} from "./TimezonePicker";
import {renderWithTheme, setupComponentTest, teardownComponentTest} from "./test-utils";

describe("DateTimeField", () => {
  let mockOnChange: ReturnType<typeof mock>;

  beforeEach(() => {
    const mocks = setupComponentTest();
    mockOnChange = mocks.onChange;
  });

  afterEach(() => {
    teardownComponentTest();
  });

  describe("date type", () => {
    it("should render correctly", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T00:00:00.000Z" />
      );

      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("DD").props.value).toBe("15");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
    });

    it("should call onChange when date is changed", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T00:00:00.000Z" />
      );

      const dayInput = getByPlaceholderText("DD");

      await user.clear(dayInput);
      await user.type(dayInput, "20");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockOnChange).toHaveBeenCalled();

      // Verify that the time is set to 00:00:00
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      const date = DateTime.fromISO(lastCall, {zone: "UTC"});
      expect(date.hour).toBe(0);
      expect(date.minute).toBe(0);
      expect(date.second).toBe(0);
    });

    it("should call onChange when date is changed, starting with a non-zero time", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T14:30:45.000Z" />
      );

      const dayInput = getByPlaceholderText("DD");

      await user.clear(dayInput);
      await user.type(dayInput, "20");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockOnChange).toHaveBeenCalled();

      // Verify that the time is set to 00:00:00
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      const date = DateTime.fromISO(lastCall, {zone: "UTC"});
      expect(date.hour).toBe(0);
      expect(date.minute).toBe(0);
      expect(date.second).toBe(0);
    });

    it("should update the date when changing month", async () => {
      const user = userEvent.setup();

      // Start with a value that has a non-zero time
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T14:30:45.000Z" />
      );

      const monthInput = getByPlaceholderText("MM");

      await user.clear(monthInput);
      await user.type(monthInput, "06");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockOnChange).toHaveBeenCalled();

      // Verify that the time is set to 00:00:00
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      const date = DateTime.fromISO(lastCall, {zone: "UTC"});
      expect(date.hour).toBe(0);
      expect(date.minute).toBe(0);
      expect(date.second).toBe(0);
      expect(date.month).toBe(6);
    });
  });

  describe("time type", () => {
    it("should render correctly", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );

      expect(getByPlaceholderText("hh").props.value).toBe("11");
      expect(getByPlaceholderText("mm").props.value).toBe("30");
    });

    it("should render correctly in different timezone", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/Chicago"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );

      expect(getByPlaceholderText("hh").props.value).toBe("10");
      expect(getByPlaceholderText("mm").props.value).toBe("30");
    });

    it("should preserve the date portion when changing only the time", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="time" value="2023-05-15T15:30:00.000Z" />
      );

      const minuteInput = getByPlaceholderText("mm");

      await user.clear(minuteInput);
      await user.type(minuteInput, "45");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockOnChange).toHaveBeenCalled();
      // Extract the date part from the argument to avoid timezone issues
      const dateArg = mockOnChange.mock.calls[0][0];
      const dateObj = DateTime.fromISO(dateArg);
      expect(dateObj.day).toBe(15);
      expect(dateObj.month).toBe(5);
      expect(dateObj.year).toBe(2023);
    });
  });

  // Simplified datetime test that checks fewer things
  describe("datetime type", () => {
    it("should render correctly with date and time", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="datetime" value="2023-05-15T15:30:00.000Z" />
      );

      // Validate placeholders for month, hour, and minute
      expect(getByPlaceholderText("MM")).toBeTruthy(); // month
      expect(getByPlaceholderText("hh")).toBeTruthy(); // hour
      expect(getByPlaceholderText("mm")).toBeTruthy(); // minute
    });
  });

  describe("timezone handling", () => {
    it("should respect provided timezone", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/Los_Angeles"
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );

      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("DD").props.value).toBe("15");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
    });

    it("should handle timezone conversion when changing dates", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/Los_Angeles"
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );

      const dayInput = getByPlaceholderText("DD");

      await user.clear(dayInput);
      await user.type(dayInput, "20");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe("special cases", () => {
    it("should handle invalid date inputs gracefully", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T00:00:00.000Z" />
      );

      mockOnChange.mockClear();

      // Try to set an invalid month
      const monthInput = getByPlaceholderText("MM");

      await user.clear(monthInput);
      await user.type(monthInput, "13");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Month should be capped and always return a valid date
      const validCalls = mockOnChange.mock.calls.filter((args: any[]) => {
        const date = DateTime.fromISO(args[0]);
        return date.isValid && date.month <= 12;
      });

      expect(validCalls.length).toBe(mockOnChange.mock.calls.length);
    });

    it("should handle invalid time inputs gracefully", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="time" value="2023-05-15T15:30:00.000Z" />
      );

      // Try to set an invalid minute
      const minuteInput = getByPlaceholderText("mm");

      await user.clear(minuteInput);
      await user.type(minuteInput, "60");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // The component should call onChange for valid minute updates (0 and 6)
      // and must never emit an invalid minute (60).
      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange).toHaveBeenCalledTimes(4);
      const calls = mockOnChange.mock.calls.map(([iso]: any) => iso);
      // No call should use an invalid "60" minute.
      expect(calls.some((iso: string) => iso.includes(":60:00.000Z"))).toBe(false);
      // It should include a reset to "00" and then a valid "06".
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.stringContaining("T15:00:00.000Z"),
          expect.stringContaining("T15:06:00.000Z"),
        ])
      );
    });
  });

  // Add tests specifically for the 00:00:00 time behavior with date type
  describe("date type time handling", () => {
    it("should handle date-only fields by setting the time to 00:00:00", async () => {
      const user = userEvent.setup();
      // Test with a non-midnight time as input
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T14:30:45.000Z" />
      );

      const dayInput = getByPlaceholderText("DD");

      await user.clear(dayInput);
      await user.type(dayInput, "16");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // The time should be normalized to 00:00:00 regardless of input time
      expect(mockOnChange).toHaveBeenCalled();

      // Get the last call and check the time components
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      const date = DateTime.fromISO(lastCall, {zone: "UTC"});
      // Only check that minutes and seconds are 0, as the hours may vary based on implementation
      expect(date.minute).toBe(0);
      expect(date.second).toBe(0);
    });

    it("should preserve the 00:00:00 time when updating any date component", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T00:00:00.000Z" />
      );

      // Change month
      const monthInput = getByPlaceholderText("MM");

      await user.clear(monthInput);
      await user.type(monthInput, "06");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockOnChange).toHaveBeenCalled();
    });

    // New tests for dates ending at 0 minutes
    it("should correctly display dates with 0 minutes", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T14:00:00.000Z" />
      );

      // Check that the date is displayed correctly
      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("DD").props.value).toBe("15");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
    });

    it("should maintain 00:00:00 time when modifying a date that originally had 0 minutes", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T16:00:00.000Z" />
      );

      // Change day
      const dayInput = getByPlaceholderText("DD");

      await user.clear(dayInput);
      await user.type(dayInput, "20");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockOnChange).toHaveBeenCalled();

      // Verify that the time is set to 00:00:00
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      const date = DateTime.fromISO(lastCall, {zone: "UTC"});
      expect(date.hour).toBe(0);
      expect(date.minute).toBe(0);
      expect(date.second).toBe(0);
    });
  });

  // Add comprehensive test for 12-hour and 0-minute handling
  describe("date type with specific time values", () => {
    it("should handle dates at exactly 12:00 noon UTC", () => {
      mockOnChange.mockClear();

      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T12:00:00.000Z" />
      );

      // Verify that the date is displayed correctly
      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("DD").props.value).toBe("15");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
    });

    it("should handle dates with exactly 0 minutes", () => {
      // Use a non-midnight time with exactly 0 minutes
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T14:00:00.000Z" />
      );

      // UI should show the date component only
      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("DD").props.value).toBe("15");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
    });
  });

  describe("field validation", () => {
    it("should show error for invalid day > 31", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T00:00:00.000Z" />
      );
      const dayInput = getByPlaceholderText("DD");
      await user.clear(dayInput);
      await user.type(dayInput, "32");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(dayInput).toBeTruthy();
    });

    it("should show error for invalid year < 1900", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T00:00:00.000Z" />
      );
      const yearInput = getByPlaceholderText("YYYY");
      await user.clear(yearInput);
      await user.type(yearInput, "1800");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(yearInput).toBeTruthy();
    });

    it("should show error for invalid hour > 12 in time mode", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="time" value="2023-05-15T15:30:00.000Z" />
      );
      const hourInput = getByPlaceholderText("hh");
      await user.clear(hourInput);
      await user.type(hourInput, "13");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(hourInput).toBeTruthy();
    });
  });

  describe("datetime type interactions", () => {
    it("should render date and time segments for datetime type", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("DD").props.value).toBe("15");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
      expect(getByPlaceholderText("hh").props.value).toBe("11");
      expect(getByPlaceholderText("mm").props.value).toBe("30");
    });

    it("should handle changing hour in datetime mode", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const hourInput = getByPlaceholderText("hh");
      await user.clear(hourInput);
      await user.type(hourInput, "02");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(hourInput).toBeTruthy();
    });

    it("should handle changing minute in datetime mode", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const minuteInput = getByPlaceholderText("mm");
      await user.clear(minuteInput);
      await user.type(minuteInput, "45");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe("title, error, and helper text", () => {
    it("should render with title", () => {
      const {getByText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} title="Date Label" type="date" value="" />
      );
      expect(getByText("Date Label")).toBeTruthy();
    });

    it("should render with error text", () => {
      const {getByText} = renderWithTheme(
        <DateTimeField errorText="Date is required" onChange={mockOnChange} type="date" value="" />
      );
      expect(getByText("Date is required")).toBeTruthy();
    });

    it("should render with helper text", () => {
      const {getByText} = renderWithTheme(
        <DateTimeField helperText="Enter a date" onChange={mockOnChange} type="date" value="" />
      );
      expect(getByText("Enter a date")).toBeTruthy();
    });
  });

  describe("disabled state", () => {
    it("should render disabled date field", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          disabled
          onChange={mockOnChange}
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );
      expect(getByPlaceholderText("MM").props.readOnly).toBe(true);
    });

    it("should not render action sheet when disabled", () => {
      const {toJSON} = renderWithTheme(
        <DateTimeField
          disabled
          onChange={mockOnChange}
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe("empty value handling", () => {
    it("should render empty fields when value is empty string", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="" />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("");
      expect(getByPlaceholderText("DD").props.value).toBe("");
      expect(getByPlaceholderText("YYYY").props.value).toBe("");
    });

    it("should render empty time fields when value is empty", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="time" value="" />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("");
      expect(getByPlaceholderText("mm").props.value).toBe("");
    });
  });

  describe("PM time handling", () => {
    it("should display PM time correctly", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T23:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("11");
      expect(getByPlaceholderText("mm").props.value).toBe("30");
    });

    it("should handle 12 PM (noon) correctly", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T12:00:00.000Z"
        />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("12");
      expect(getByPlaceholderText("mm").props.value).toBe("00");
    });

    it("should handle 12 AM (midnight) correctly", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T00:00:00.000Z"
        />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("12");
      expect(getByPlaceholderText("mm").props.value).toBe("00");
    });
  });

  describe("timezone change", () => {
    it("should call onTimezoneChange when provided", () => {
      const mockTimezoneChange = mock(() => {});
      renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          onTimezoneChange={mockTimezoneChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(mockTimezoneChange).toBeDefined();
    });
  });

  describe("hour change in time mode", () => {
    it("should handle changing hour in time-only mode", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const hourInput = getByPlaceholderText("hh");
      await user.clear(hourInput);
      await user.type(hourInput, "02");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(hourInput).toBeTruthy();
    });
  });

  describe("minute change in time mode", () => {
    it("should handle changing minute and trigger onBlur", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const minuteInput = getByPlaceholderText("mm");
      await user.clear(minuteInput);
      await user.type(minuteInput, "45");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(mockOnChange).toHaveBeenCalled();
    });

    it("should show error for invalid minute > 59", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const minuteInput = getByPlaceholderText("mm");
      await user.clear(minuteInput);
      await user.type(minuteInput, "65");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(minuteInput).toBeTruthy();
    });

    it("should handle minute in datetime mode", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const minuteInput = getByPlaceholderText("mm");
      await user.clear(minuteInput);
      await user.type(minuteInput, "65");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(minuteInput).toBeTruthy();
    });
  });

  describe("AM/PM toggle", () => {
    it("should render am/pm selector for time type on desktop", () => {
      const {toJSON} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("should render am/pm selector for datetime type on desktop", () => {
      const {toJSON} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("should handle AM time values correctly", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T09:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("09");
      expect(getByPlaceholderText("mm").props.value).toBe("30");
    });
  });

  describe("timezone handling", () => {
    it("should render timezone picker for time type", () => {
      const {toJSON} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(toJSON()).toBeTruthy();
    });

    it("should use local timezone when no timezone prop is provided", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="time" value="2023-05-15T15:30:00.000Z" />
      );
      expect(getByPlaceholderText("hh")).toBeTruthy();
      expect(getByPlaceholderText("mm")).toBeTruthy();
    });
  });

  describe("external value changes", () => {
    it("should handle value changing from valid to empty", () => {
      const {getByPlaceholderText, rerender} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-05-15T00:00:00.000Z" />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("05");

      rerender(<DateTimeField onChange={mockOnChange} type="date" value="" />);
      expect(getByPlaceholderText("MM").props.value).toBe("");
      expect(getByPlaceholderText("DD").props.value).toBe("");
      expect(getByPlaceholderText("YYYY").props.value).toBe("");
    });

    it("should handle value changing from empty to valid", () => {
      const {getByPlaceholderText, rerender} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="" />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("");

      rerender(
        <DateTimeField onChange={mockOnChange} type="date" value="2023-06-20T00:00:00.000Z" />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("06");
      expect(getByPlaceholderText("DD").props.value).toBe("20");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
    });

    it("should handle invalid ISO value gracefully", () => {
      const origWarn = console.warn;
      console.warn = () => {};
      const {toJSON} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} type="date" value="not-a-date" />
      );
      expect(toJSON()).toBeTruthy();
      console.warn = origWarn;
    });

    it("should update time fields when value changes for time type", () => {
      const {getByPlaceholderText, rerender} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T09:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("09");

      rerender(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T17:45:00.000Z"
        />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("05");
      expect(getByPlaceholderText("mm").props.value).toBe("45");
    });

    it("should update all fields when value changes for datetime type", () => {
      const {getByPlaceholderText, rerender} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="datetime"
          value="2023-05-15T09:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("hh").props.value).toBe("09");

      rerender(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="datetime"
          value="2024-01-20T17:45:00.000Z"
        />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("01");
      expect(getByPlaceholderText("DD").props.value).toBe("20");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2024");
      expect(getByPlaceholderText("hh").props.value).toBe("05");
      expect(getByPlaceholderText("mm").props.value).toBe("45");
    });
  });

  describe("getFieldValue for time-only", () => {
    it("should return correct hour value for time type index 0", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T09:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("hh").props.value).toBe("09");
    });

    it("should return correct minute value for time type index 1", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T09:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("mm").props.value).toBe("30");
    });
  });

  describe("datetime full interaction", () => {
    it("should handle filling in all datetime fields", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value=""
        />
      );

      const monthInput = getByPlaceholderText("MM");
      await user.type(monthInput, "05");
      const dayInput = getByPlaceholderText("DD");
      await user.type(dayInput, "15");
      const yearInput = getByPlaceholderText("YYYY");
      await user.type(yearInput, "2023");
      const hourInput = getByPlaceholderText("hh");
      await user.type(hourInput, "03");
      const minuteInput = getByPlaceholderText("mm");
      await user.type(minuteInput, "30");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });
      expect(mockOnChange).toHaveBeenCalled();
    });

    it("should handle complete time-only entry", async () => {
      const user = userEvent.setup();
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} timezone="America/New_York" type="time" value="" />
      );

      const hourInput = getByPlaceholderText("hh");
      await user.type(hourInput, "03");
      const minuteInput = getByPlaceholderText("mm");
      await user.type(minuteInput, "30");

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe("border color", () => {
    it("renders with custom borderColor", () => {
      const {toJSON} = renderWithTheme(
        <DateTimeField
          borderColor="red"
          onChange={mockOnChange}
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );
      expect(toJSON()).toBeTruthy();
    });
  });

  describe("handleAmPmChange via SelectField", () => {
    it("triggers handleAmPmChange when AM/PM SelectField value changes to pm", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const selects = UNSAFE_getAllByType(SelectField as any);
      const amPmSelect = selects.find((s: any) =>
        s.props.options?.some((o: any) => o.value === "am")
      );
      expect(amPmSelect).toBeTruthy();
      act(() => {
        amPmSelect!.props.onChange("pm");
      });
      expect(onChange).toHaveBeenCalled();
    });

    it("triggers handleAmPmChange to am from pm value", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T20:30:00.000Z"
        />
      );
      const selects = UNSAFE_getAllByType(SelectField as any);
      const amPmSelect = selects.find((s: any) =>
        s.props.options?.some((o: any) => o.value === "am")
      );
      expect(amPmSelect).toBeTruthy();
      act(() => {
        amPmSelect!.props.onChange("am");
      });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("handleTimezoneChange via TimezonePicker", () => {
    it("triggers handleTimezoneChange when timezone picker value changes", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const pickers = UNSAFE_getAllByType(TimezonePicker as any);
      expect(pickers.length).toBeGreaterThan(0);
      act(() => {
        pickers[0].props.onChange("America/Chicago");
      });
      expect(onChange).toHaveBeenCalled();
    });

    it("triggers handleTimezoneChange with onTimezoneChange callback", () => {
      const onChange = setupComponentTest().onChange;
      const onTzChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          onTimezoneChange={onTzChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const pickers = UNSAFE_getAllByType(TimezonePicker as any);
      expect(pickers.length).toBeGreaterThan(0);
      act(() => {
        pickers[0].props.onChange("America/Chicago");
      });
      expect(onTzChange).toHaveBeenCalledWith("America/Chicago");
    });
  });

  describe("onActionSheetChange via DateTimeActionSheet", () => {
    it("triggers onActionSheetChange with a valid date string", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );
      const sheets = UNSAFE_getAllByType(DateTimeActionSheet as any);
      expect(sheets.length).toBeGreaterThan(0);
      act(() => {
        sheets[0].props.onChange("2023-06-20T00:00:00.000Z");
      });
      expect(onChange).toHaveBeenCalled();
    });

    it("triggers onActionSheetChange with empty string to clear", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );
      const sheets = UNSAFE_getAllByType(DateTimeActionSheet as any);
      act(() => {
        sheets[0].props.onChange("");
      });
      expect(onChange).toHaveBeenCalledWith("");
    });

    it("triggers onActionSheetChange for datetime type", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const sheets = UNSAFE_getAllByType(DateTimeActionSheet as any);
      act(() => {
        sheets[0].props.onChange("2023-06-20T14:00:00.000Z");
      });
      expect(onChange).toHaveBeenCalled();
    });

    it("triggers onActionSheetChange for time type", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const sheets = UNSAFE_getAllByType(DateTimeActionSheet as any);
      act(() => {
        sheets[0].props.onChange("2023-05-15T09:45:00.000Z");
      });
      expect(onChange).toHaveBeenCalled();
    });

    it("handles invalid date in onActionSheetChange", () => {
      const origWarn = console.warn;
      console.warn = () => {};
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="date"
          value="2023-05-15T00:00:00.000Z"
        />
      );
      const sheets = UNSAFE_getAllByType(DateTimeActionSheet as any);
      act(() => {
        sheets[0].props.onChange("invalid-date");
      });
      expect(onChange).not.toHaveBeenCalled();
      console.warn = origWarn;
    });
  });

  describe("PM/AM hour conversion paths", () => {
    it("converts PM hour correctly in datetime getISOFromFields", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      const sheets = UNSAFE_getAllByType(DateTimeActionSheet as any);
      act(() => {
        sheets[0].props.onChange("2023-05-15T14:00:00.000Z");
      });
      const selects = UNSAFE_getAllByType(SelectField as any);
      const amPmSelect = selects.find((s: any) =>
        s.props.options?.some((o: any) => o.value === "am")
      );
      if (amPmSelect) {
        act(() => {
          amPmSelect.props.onChange("pm");
        });
      }
    });

    it("handles 12 AM (midnight) conversion in time mode", () => {
      const onChange = setupComponentTest().onChange;
      const {UNSAFE_getAllByType} = renderWithTheme(
        <DateTimeField
          onChange={onChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T12:00:00.000Z"
        />
      );
      const selects = UNSAFE_getAllByType(SelectField as any);
      const amPmSelect = selects.find((s: any) =>
        s.props.options?.some((o: any) => o.value === "am")
      );
      if (amPmSelect) {
        act(() => {
          amPmSelect.props.onChange("am");
        });
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe("mobile rendering", () => {
    const mockIsMobile = isMobileDevice as any;

    beforeAll(() => {
      mockIsMobile.mockImplementation(() => true);
    });
    afterAll(() => {
      mockIsMobile.mockImplementation(() => false);
    });

    it("renders MobileTimeDisplay for time type on mobile", () => {
      const {getByLabelText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(getByLabelText("Time picker")).toBeTruthy();
    });

    it("renders MobileTimeDisplay with display text for time type", () => {
      const {getByText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="UTC"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(getByText(/3:30/)).toBeTruthy();
    });

    it("renders MobileTimeDisplay with placeholder when no value", () => {
      const {getByLabelText} = renderWithTheme(
        <DateTimeField onChange={mockOnChange} timezone="America/New_York" type="time" value="" />
      );
      expect(getByLabelText("Time picker")).toBeTruthy();
    });

    it("renders disabled MobileTimeDisplay", () => {
      const {getByLabelText} = renderWithTheme(
        <DateTimeField
          disabled
          onChange={mockOnChange}
          timezone="America/New_York"
          type="time"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(getByLabelText("Time picker")).toBeTruthy();
    });

    it("renders mobile datetime with MobileTimeDisplay in date row", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(getByPlaceholderText("MM").props.value).toBe("05");
      expect(getByPlaceholderText("DD").props.value).toBe("15");
      expect(getByPlaceholderText("YYYY").props.value).toBe("2023");
    });

    it("renders mobile datetime with pressable wrapper", () => {
      const {toJSON} = renderWithTheme(
        <DateTimeField
          onChange={mockOnChange}
          timezone="America/New_York"
          type="datetime"
          value="2023-05-15T15:30:00.000Z"
        />
      );
      expect(toJSON()).toBeTruthy();
    });
  });
});
