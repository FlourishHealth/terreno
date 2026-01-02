import {
  Box,
  Button,
  DateTimeField,
  type DateTimeFieldProps,
  Heading,
  printDateAndTime,
  Text,
} from "@terreno/ui";
import {DateTime} from "luxon";
import {type ReactElement, useState} from "react";

export const DateTimeFieldDemo = (props: Partial<DateTimeFieldProps>): ReactElement => {
  const [value, setValue] = useState("");
  return (
    <Box maxWidth={500}>
      <DateTimeField
        helperText="Supporting helper text"
        onChange={(v) => {
          setValue(v);
        }}
        title="Date and Time Field"
        type="datetime"
        value={value}
        {...props}
      />
    </Box>
  );
};

export const DateTimeFieldStory = (): ReactElement => {
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");

  const [disabled, setDisabled] = useState(false);
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  return (
    <Box gap={2} maxWidth={500}>
      <Box padding={2}>
        <Heading>DateTimeField with timezone handling</Heading>
      </Box>
      <DateTimeField
        disabled={disabled}
        helperText={disabled ? "Tell the user why this is disabled." : undefined}
        onChange={(v) => {
          setValue(v);
        }}
        onTimezoneChange={setTimezone}
        timezone={timezone}
        title="type datetime"
        type="datetime"
        value={value}
      />
      <Box padding={2}>
        <Text>
          Current value: {value || "No date selected"}, TZ: {timezone}
        </Text>
        <Text>Formatted: {value ? printDateAndTime(value) : "No date selected"}</Text>
      </Box>

      <Button onClick={() => setDisabled(!disabled)} text="Toggle Disabled" />

      <Box padding={2}>
        <Heading>DateTimeField without timezone handling</Heading>
      </Box>
      <DateTimeField
        onChange={(v) => {
          setValue2(v);
        }}
        title="datetime without timezone handling"
        type="datetime"
        value={value2}
      />
      <Box padding={2}>
        <Text>Current value: {value2 || "No date selected"}</Text>
        <Text>Formatted: {value2 ? printDateAndTime(value2) : "No date selected"}</Text>
      </Box>
    </Box>
  );
};

export const DateTimeFieldTypes = (): ReactElement => {
  const [datetimeValue, setDatetimeValue] = useState("");
  const [dateValue, setDateValue] = useState(DateTime.now().toUTC().startOf("day").toISO());
  const [timeValue, setTimeValue] = useState("");
  const [disabled, setDisabled] = useState(false);

  return (
    <Box gap={2} maxWidth={500}>
      <Box padding={3}>
        <DateTimeField
          disabled={disabled}
          onChange={(v) => {
            setDatetimeValue(v);
          }}
          title="type datetime"
          type="datetime"
          value={datetimeValue}
        />
      </Box>
      <Box padding={3}>
        <DateTimeField
          disabled={disabled}
          onChange={(v) => {
            setDateValue(v);
          }}
          title="type date"
          type="date"
          value={dateValue}
        />
      </Box>
      <Box padding={3}>
        <DateTimeField
          disabled={disabled}
          onChange={(v) => {
            setTimeValue(v);
          }}
          title="type time"
          type="time"
          value={timeValue}
        />
      </Box>
      <Box width={200}>
        <Button onClick={() => setDisabled(!disabled)} text="Toggle Disabled" />
      </Box>
      <Box paddingY={4}>
        <Text bold>Datetime: {datetimeValue}</Text>
        <Text bold>Date: {dateValue}</Text>
        <Text bold>Time: {timeValue}</Text>
      </Box>
    </Box>
  );
};
