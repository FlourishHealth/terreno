import {Box, type FieldOption, Heading, SelectField} from "@terreno/ui";

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

export const SelectFieldDemo = (props: {
  withErrorText: boolean;
  withHelperText: boolean;
  withTitle: boolean;
  disabled: boolean;
}) => {
  return (
    <SelectField
      // disabled={props.disabled}
      errorText={props.withErrorText ? "This is an error" : undefined}
      helperText={props.withHelperText ? "This is some helper text" : undefined}
      onChange={() => {}}
      options={options}
      title={props.withTitle ? "Select field" : undefined}
      value=""
      {...props}
    />
  );
};

export const SelectFieldExamples = () => {
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
          <Heading size="md">With errorText</Heading>
        </Box>
        <SelectField
          errorText="This is an error"
          onChange={() => {}}
          options={options}
          title="Select field"
          value="second"
        />
      </Box>
      <Box marginBottom={2} padding={4}>
        <Box marginBottom={1}>
          <Heading size="md">Disabled</Heading>
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
