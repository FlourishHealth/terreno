import {BooleanField, Box, type FieldOption, Heading, SelectField, Text} from "@terreno/ui";
import {type ReactElement, useState} from "react";
import {Platform} from "react-native";

const options: FieldOption[] = [
  {label: "First", value: "first"},
  {label: "Second", value: "second"},
  {label: "Third, A Really Long Option", value: "third"},
  {
    label:
      "This is an extremely long option label designed to test how the select field handles text wrapping in the disabled read-only state across web and native platforms, ensuring that long content is displayed in full rather than being clipped or truncated by a single-line constraint",
    value: "long",
  },
];

const searchableOptions: FieldOption[] = [
  {label: "Apple", value: "apple"},
  {label: "Apricot", value: "apricot"},
  {label: "Avocado", value: "avocado"},
  {label: "Banana", value: "banana"},
  {label: "Blackberry", value: "blackberry"},
  {label: "Blueberry", value: "blueberry"},
  {label: "Cherry", value: "cherry"},
  {label: "Coconut", value: "coconut"},
  {label: "Grape", value: "grape"},
  {label: "Grapefruit", value: "grapefruit"},
  {label: "Kiwi", value: "kiwi"},
  {label: "Lemon", value: "lemon"},
  {label: "Lime", value: "lime"},
  {label: "Mango", value: "mango"},
  {label: "Orange", value: "orange"},
  {label: "Peach", value: "peach"},
  {label: "Pear", value: "pear"},
  {label: "Pineapple", value: "pineapple"},
  {label: "Plum", value: "plum"},
  {label: "Raspberry", value: "raspberry"},
  {label: "Strawberry", value: "strawberry"},
  {label: "Watermelon", value: "watermelon"},
];

const MANY_OPTIONS_COUNT = 150;

const manyOptions: FieldOption[] = Array.from({length: MANY_OPTIONS_COUNT}, (_, index) => {
  const optionNumber = index + 1;
  return {
    label: `Option ${String(optionNumber).padStart(3, "0")}`,
    value: `option-${optionNumber}`,
  };
});

export const SelectFieldLongListDemo = (): ReactElement => {
  const [value, setValue] = useState("");

  return (
    <Box gap={2} width="100%">
      <Text color="secondaryLight" size="sm">
        {MANY_OPTIONS_COUNT} options — open the menu to verify scrolling and search filtering.
      </Text>
      <SelectField
        helperText="Opens a centered modal on Android with search and scroll-to-selected."
        onChange={setValue}
        options={manyOptions}
        searchable
        title={`Pick one of ${MANY_OPTIONS_COUNT} options`}
        value={value}
      />
    </Box>
  );
};

export const SelectFieldDemo = (props: {
  withErrorText: boolean;
  withHelperText: boolean;
  withTitle: boolean;
  disabled: boolean;
  searchable: boolean;
}): ReactElement => {
  const {withErrorText, withHelperText, withTitle, disabled, searchable} = props;
  const [value, setValue] = useState("");

  return (
    <Box gap={2} width="100%">
      {Platform.OS === "web" && (
        <Text color="secondaryLight" size="sm">
          Open the dropdown to use the search filter when searchable is enabled.
        </Text>
      )}
      <SelectField
        disabled={disabled}
        errorText={withErrorText ? "This is an error" : undefined}
        helperText={withHelperText ? "This is some helper text" : undefined}
        key={searchable ? "searchable" : "plain"}
        onChange={setValue}
        options={searchableOptions}
        searchable={searchable}
        title={withTitle ? "Select field" : undefined}
        value={value}
      />
    </Box>
  );
};

export const SelectFieldSearchableDemo = (): ReactElement => {
  const [value, setValue] = useState("");
  const [searchable, setSearchable] = useState(true);

  return (
    <Box gap={4} width="100%">
      <BooleanField
        onChange={setSearchable}
        title="Searchable"
        value={searchable}
        variant="title"
      />
      <SelectField
        helperText={
          Platform.OS === "web"
            ? "Type in the field to filter options as you open the menu."
            : "Open the menu and use the search box to filter options."
        }
        key={searchable ? "searchable" : "plain"}
        onChange={setValue}
        options={searchableOptions}
        searchable={searchable}
        title="Pick a fruit"
        value={value}
      />
    </Box>
  );
};

export const SelectFieldExamples = (): ReactElement => {
  return (
    <Box flex="grow" gap={4} height="100%" padding={2} scroll width="100%">
      <Box gap={2} width="100%">
        <Heading size="md">Standard - No title, errorText, or helperText</Heading>
        <SelectField onChange={() => {}} options={options} value="" />
      </Box>
      <Box gap={2} width="100%">
        <Heading size="md">With title</Heading>
        <SelectField onChange={() => {}} options={options} title="Select field" value="" />
      </Box>
      <Box gap={2} width="100%">
        <Heading size="md">With helperText</Heading>
        <SelectField
          helperText="This is some helper text"
          onChange={() => {}}
          options={options}
          title="Select field"
          value="first"
        />
      </Box>
      <Box gap={2} width="100%">
        <Heading size="md">Disabled — long label wrapping test</Heading>
        <SelectField
          disabled
          onChange={() => {}}
          options={options}
          title="Select field (disabled, short label)"
          value="third"
        />
      </Box>
      <Box gap={2} width="100%">
        <Heading size="md">Searchable</Heading>
        <SelectFieldSearchableDemo />
      </Box>
      <Box gap={2} width="100%">
        <Heading size="md">Many options ({MANY_OPTIONS_COUNT})</Heading>
        <SelectFieldLongListDemo />
      </Box>
      <Box gap={2} width="100%">
        <Heading size="md">Disabled — long label wrapping test</Heading>
        <SelectField
          disabled
          onChange={() => {}}
          options={options}
          title="Select field (disabled, long label)"
          value="long"
        />
      </Box>
    </Box>
  );
};
