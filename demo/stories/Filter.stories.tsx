import {
  Box,
  Card,
  Filter,
  FilterChip,
  type FilterDefinition,
  type FilterProps,
  type FilterValues,
  Heading,
  Text,
} from "@terreno/ui";
import {useCallback, useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

const todoFilters: FilterDefinition[] = [
  {field: "completed", kind: "boolean", label: "Completed"},
  {
    field: "priority",
    kind: "choice",
    label: "Priority",
    options: [
      {label: "Low", value: "low"},
      {label: "Medium", value: "medium"},
      {label: "High", value: "high"},
    ],
  },
  {
    field: "tags",
    kind: "multiChoice",
    label: "Tags",
    options: [
      {label: "Work", value: "work"},
      {label: "Home", value: "home"},
      {label: "Errands", value: "errands"},
    ],
  },
  {field: "created", kind: "dateRange", label: "Created"},
  {field: "estimate", kind: "numberRange", label: "Estimate (hours)", max: 40, min: 0},
];

export const FilterDemo = (props: Partial<FilterProps>) => {
  const [values, setValues] = useState<FilterValues>({completed: false, tags: ["work"]});
  const [search, setSearch] = useState("");

  const handleClear = useCallback(() => {
    setValues({});
    setSearch("");
  }, []);

  return (
    <Box padding={3} width="100%">
      <Card padding={4}>
        <Filter
          filters={todoFilters}
          onChange={setValues}
          onClear={handleClear}
          onSearchChange={setSearch}
          searchPlaceholder="Search todos"
          searchValue={search}
          values={values}
          {...props}
        />
      </Card>
    </Box>
  );
};

/** A sidebar rail beside a result list — the layout an admin changelist uses. */
export const FilterStackedStory = () => {
  const [values, setValues] = useState<FilterValues>({priority: "high"});
  const [search, setSearch] = useState("");

  const handleClear = useCallback(() => {
    setValues({});
    setSearch("");
  }, []);

  return (
    <StorybookContainer>
      <Box direction="row" gap={4} width="100%" wrap>
        <Box flex="grow" minWidth={280}>
          <Card padding={4}>
            <Heading size="sm">Results</Heading>
            <Box marginTop={2}>
              <Text color="secondaryLight">
                {`Search: ${search || "(none)"} · Filters: ${JSON.stringify(values)}`}
              </Text>
            </Box>
          </Card>
        </Box>
        <Box maxWidth={360} minWidth={280}>
          <Card padding={4}>
            <Filter
              filters={todoFilters}
              onChange={setValues}
              onClear={handleClear}
              onSearchChange={setSearch}
              searchValue={search}
              testID="stackedFilter"
              values={values}
            />
          </Card>
        </Box>
      </Box>
    </StorybookContainer>
  );
};

/** A toolbar above a table, collapsed by default so the table stays the focus. */
export const FilterInlineStory = () => {
  const [values, setValues] = useState<FilterValues>({completed: true, tags: ["home", "errands"]});

  return (
    <StorybookContainer>
      <Card padding={4}>
        <Filter
          collapsible
          filters={todoFilters}
          layout="inline"
          onChange={setValues}
          testID="inlineFilter"
          title="Filter todos"
          values={values}
        />
      </Card>
    </StorybookContainer>
  );
};

/** The chip on its own, for consumers rendering applied filters somewhere else. */
export const FilterChipStory = () => {
  return (
    <StorybookContainer>
      <Box direction="row" gap={2} wrap>
        <FilterChip label="Priority" onDismiss={() => console.info("dismiss")} value="High" />
        <FilterChip label="Tags" onDismiss={() => console.info("dismiss")} value="Work" />
        <FilterChip label="Created" value="On or after Mar 4, 2026" />
        <FilterChip disabled label="Owner" onDismiss={() => console.info("dismiss")} value="Me" />
      </Box>
    </StorybookContainer>
  );
};
