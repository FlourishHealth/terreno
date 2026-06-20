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
      {Platform.OS !== "web" && (
        <Text color="secondaryLight">
          Searchable filtering only applies on web. Run the demo with `bun run web` to try it.
        </Text>
      )}
      <BooleanField
        onChange={setSearchable}
        title="Searchable"
        value={searchable}
        variant="title"
      />
      <SelectField
        helperText="Type in the search box after opening the menu to filter options by label."
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
    <Box>
      <Box marginBottom={2} padding={4}>
        <Box marginBottom={4}>
          <Heading size="md">Standard - No title, errorText, or helperText</Heading>
        </Box>
        <SelectField onChange={() => {}} options={options} value="" />
      </Box>
      <Box marginBottom={2} padding={4}>
        <Box marginBottom={1}>
          <Heading size="md">With title</Heading>
        </Box>
        <SelectField onChange={() => {}} options={options} title="Select field" value="" />
      </Box>
      <Box marginBottom={4} padding={2}>
        <Box marginBottom={1}>
          <Heading size="md">With helperText</Heading>
        </Box>
        <SelectField
          helperText="This is some helper text"
          onChange={() => {}}
          options={options}
          title="Select field"
          value="first"
        />
      </Box>

      <Box marginBottom={2} padding={4}>
        <Box marginBottom={1}>
          <Heading size="md">Disabled — long label wrapping test</Heading>
        </Box>
        <SelectField
          disabled
          onChange={() => {}}
          options={options}
          title="Select field (disabled, short label)"
          value="third"
        />
      </Box>
      <Box marginBottom={2} padding={4}>
        <Box marginBottom={1}>
          <Heading size="md">Searchable (web)</Heading>
        </Box>
        <SelectFieldSearchableDemo />
      </Box>
      <Box marginBottom={2} padding={4}>
        <Box marginBottom={1}>
          <Heading size="md">Disabled — long label wrapping test</Heading>
        </Box>
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
