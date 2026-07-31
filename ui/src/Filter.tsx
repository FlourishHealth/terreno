import {type FC, type ReactElement, useCallback, useMemo, useState} from "react";
import {Pressable, View} from "react-native";

import {Badge} from "./Badge";
import {Box} from "./Box";
import type {BoxProps, FilterDefinition, FilterFieldValue, FilterProps} from "./Common";
import {DateTimeField} from "./DateTimeField";
import {FilterChip} from "./FilterChip";
import {FieldTitle} from "./fieldElements/FieldTitle";
import {
  clearFilterField,
  clearFilterValues,
  getActiveFilters,
  getDateRangeValue,
  getFilterLabel,
  getMultiChoiceValue,
  getNumberRangeValue,
} from "./filterUtils";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {MultiselectField} from "./MultiselectField";
import {NumberField} from "./NumberField";
import {SelectField} from "./SelectField";
import {Text} from "./Text";
import {TextField} from "./TextField";
import {resolveTestID} from "./testing/resolveTestId";

/** Sentinel used by the boolean and choice pickers for "no constraint". */
const ANY_VALUE = "";

const parseNumber = (raw: string): number | undefined => {
  if (raw.trim() === "") {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const Filter: FC<FilterProps> = ({
  filters,
  values,
  onChange,
  title = "Filters",
  layout = "stacked",
  collapsible = false,
  defaultExpanded = true,
  showActiveFilters = true,
  showClearAll = true,
  clearAllText = "Clear all",
  onClear,
  searchValue,
  onSearchChange,
  searchTitle = "Search",
  searchPlaceholder,
  testID,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const activeFilters = useMemo(() => {
    return getActiveFilters({filters, values});
  }, [filters, values]);

  const isInline = layout === "inline";
  const areControlsVisible = !collapsible || isExpanded;
  const hasSearch = Boolean(onSearchChange);
  // Search has no chip, but it still constrains results, so clear-all has to offer to reset it.
  const hasActiveSearch = hasSearch && Boolean(searchValue?.trim());
  const hasActiveConstraints = activeFilters.length > 0 || hasActiveSearch;

  // Box maps an explicit `flex` of anything but grow/shrink to `flex: 0`, which zeroes the
  // flex basis and collapses a column child's height. Stacked wrappers therefore omit `flex`
  // and `wrap` entirely rather than passing a falsy value.
  const controlsContainerProps: BoxProps = isInline
    ? {direction: "row", gap: 4, width: "100%", wrap: true}
    : {direction: "column", gap: 3, width: "100%"};
  const controlWrapperProps: BoxProps = isInline ? {flex: "grow", minWidth: 200} : {width: "100%"};
  const rangeItemProps: BoxProps = isInline ? {flex: "grow", minWidth: 0} : {width: "100%"};

  const handleFieldChange = useCallback(
    (field: string, next: FilterFieldValue) => {
      onChange({...values, [field]: next});
    },
    [onChange, values]
  );

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded((previous) => !previous);
  }, []);

  const handleClearAll = useCallback(() => {
    if (onClear) {
      onClear();
      return;
    }
    onChange(clearFilterValues({filters, values}));
    onSearchChange?.("");
  }, [filters, onChange, onClear, onSearchChange, values]);

  const handleDismissChip = useCallback(
    (field: string, optionValue?: string) => {
      const definition = filters.find((entry) => entry.field === field);
      if (!definition) {
        return;
      }
      onChange(clearFilterField({definition, optionValue, values}));
    },
    [filters, onChange, values]
  );

  const renderControl = (definition: FilterDefinition): ReactElement | null => {
    const label = getFilterLabel(definition);
    const controlTestID = resolveTestID(testID, `filter.${definition.field}`);
    const value = values[definition.field];

    if (definition.kind === "boolean") {
      const selected = value === true ? "true" : value === false ? "false" : ANY_VALUE;
      return (
        <SelectField
          disabled={definition.disabled}
          helperText={definition.helperText}
          onChange={(next: string) => {
            if (next === "true") {
              handleFieldChange(definition.field, true);
            } else if (next === "false") {
              handleFieldChange(definition.field, false);
            } else {
              handleFieldChange(definition.field, undefined);
            }
          }}
          options={[
            {label: definition.anyLabel ?? "All", value: ANY_VALUE},
            {label: definition.trueLabel ?? "Yes", value: "true"},
            {label: definition.falseLabel ?? "No", value: "false"},
          ]}
          requireValue
          testID={controlTestID}
          title={label}
          value={selected}
        />
      );
    }

    if (definition.kind === "choice") {
      return (
        <SelectField
          disabled={definition.disabled}
          helperText={definition.helperText}
          onChange={(next: string) => handleFieldChange(definition.field, next)}
          options={[{label: definition.anyLabel ?? "All", value: ANY_VALUE}, ...definition.options]}
          requireValue
          testID={controlTestID}
          title={label}
          value={typeof value === "string" ? value : ANY_VALUE}
        />
      );
    }

    if (definition.kind === "multiChoice") {
      return (
        <MultiselectField
          disabled={definition.disabled}
          helperText={definition.helperText}
          onChange={(next: string[]) => handleFieldChange(definition.field, next)}
          options={definition.options}
          testID={controlTestID}
          title={label}
          value={getMultiChoiceValue(value)}
        />
      );
    }

    if (definition.kind === "text") {
      return (
        <TextField
          disabled={definition.disabled}
          helperText={definition.helperText}
          onChange={(next: string) => handleFieldChange(definition.field, next)}
          placeholder={definition.placeholder}
          testID={controlTestID}
          title={label}
          value={typeof value === "string" ? value : ""}
        />
      );
    }

    if (definition.kind === "dateRange") {
      const range = getDateRangeValue(value);
      return (
        <Box direction="column" gap={2} width="100%">
          <FieldTitle testID={resolveTestID(controlTestID, "label")} text={label} />
          <Box direction={isInline ? "row" : "column"} gap={2} width="100%">
            <Box {...rangeItemProps}>
              <DateTimeField
                disabled={definition.disabled}
                onChange={(next: string) =>
                  handleFieldChange(definition.field, {...range, from: next || undefined})
                }
                showTimezone={false}
                testID={resolveTestID(controlTestID, "from")}
                title={definition.fromLabel ?? "From"}
                type={definition.type ?? "date"}
                value={range.from}
              />
            </Box>
            <Box {...rangeItemProps}>
              <DateTimeField
                disabled={definition.disabled}
                onChange={(next: string) =>
                  handleFieldChange(definition.field, {...range, to: next || undefined})
                }
                showTimezone={false}
                testID={resolveTestID(controlTestID, "to")}
                title={definition.toLabel ?? "To"}
                type={definition.type ?? "date"}
                value={range.to}
              />
            </Box>
          </Box>
          {Boolean(definition.helperText) && (
            <Text color="secondaryLight" size="sm">
              {definition.helperText}
            </Text>
          )}
        </Box>
      );
    }

    if (definition.kind === "numberRange") {
      const range = getNumberRangeValue(value);
      return (
        <Box direction="column" gap={2} width="100%">
          <FieldTitle testID={resolveTestID(controlTestID, "label")} text={label} />
          <Box direction="row" gap={2} width="100%">
            <Box flex="grow" minWidth={0}>
              <NumberField
                disabled={definition.disabled}
                max={definition.max}
                min={definition.min}
                onChange={(next: string) =>
                  handleFieldChange(definition.field, {...range, from: parseNumber(next)})
                }
                testID={resolveTestID(controlTestID, "from")}
                title={definition.fromLabel ?? "Min"}
                type={definition.type ?? "number"}
                value={range.from === undefined ? "" : String(range.from)}
              />
            </Box>
            <Box flex="grow" minWidth={0}>
              <NumberField
                disabled={definition.disabled}
                max={definition.max}
                min={definition.min}
                onChange={(next: string) =>
                  handleFieldChange(definition.field, {...range, to: parseNumber(next)})
                }
                testID={resolveTestID(controlTestID, "to")}
                title={definition.toLabel ?? "Max"}
                type={definition.type ?? "number"}
                value={range.to === undefined ? "" : String(range.to)}
              />
            </Box>
          </Box>
          {Boolean(definition.helperText) && (
            <Text color="secondaryLight" size="sm">
              {definition.helperText}
            </Text>
          )}
        </Box>
      );
    }

    return null;
  };

  const hasHeader = Boolean(title) || collapsible || (showClearAll && hasActiveConstraints);

  return (
    <View style={{width: "100%"}} testID={testID}>
      <Box direction="column" gap={3} width="100%">
        {Boolean(hasHeader) && (
          <Box direction="row" gap={2} justifyContent="between" width="100%" wrap>
            <Box alignItems="center" direction="row" gap={2}>
              {Boolean(title) && <Heading size="sm">{title}</Heading>}
              {activeFilters.length > 0 && (
                <Badge
                  status="info"
                  testID={resolveTestID(testID, "count")}
                  value={String(activeFilters.length)}
                  variant="numberOnly"
                />
              )}
            </Box>
            <Box alignItems="center" direction="row" gap={4}>
              {Boolean(showClearAll && hasActiveConstraints) && (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleClearAll}
                  testID={resolveTestID(testID, "clearAll")}
                >
                  <Text color="link" size="sm">
                    {clearAllText}
                  </Text>
                </Pressable>
              )}
              {Boolean(collapsible) && (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleToggleExpanded}
                  testID={resolveTestID(testID, "toggle")}
                >
                  <Box alignItems="center" direction="row" gap={2}>
                    <Text color="link" size="sm">
                      {isExpanded ? "Hide" : "Show"}
                    </Text>
                    <Icon
                      color="link"
                      iconName={isExpanded ? "chevron-up" : "chevron-down"}
                      size="sm"
                    />
                  </Box>
                </Pressable>
              )}
            </Box>
          </Box>
        )}

        {Boolean(showActiveFilters && activeFilters.length > 0) && (
          <Box
            direction="row"
            gap={2}
            testID={resolveTestID(testID, "activeFilters")}
            width="100%"
            wrap
          >
            {activeFilters.map((activeFilter) => {
              const chipKey = activeFilter.optionValue
                ? `${activeFilter.field}.${activeFilter.optionValue}`
                : activeFilter.field;
              return (
                <FilterChip
                  disabled={filters.find((entry) => entry.field === activeFilter.field)?.disabled}
                  key={chipKey}
                  label={activeFilter.label}
                  onDismiss={() => handleDismissChip(activeFilter.field, activeFilter.optionValue)}
                  testID={resolveTestID(testID, `chip.${chipKey}`)}
                  value={activeFilter.value}
                />
              );
            })}
          </Box>
        )}

        {Boolean(areControlsVisible) && (
          <Box {...controlsContainerProps}>
            {Boolean(hasSearch) && (
              <Box {...controlWrapperProps}>
                <TextField
                  onChange={(next: string) => onSearchChange?.(next)}
                  placeholder={searchPlaceholder}
                  testID={resolveTestID(testID, "search")}
                  title={searchTitle}
                  type="search"
                  value={searchValue ?? ""}
                />
              </Box>
            )}
            {filters.map((definition) => (
              <Box key={definition.field} {...controlWrapperProps}>
                {renderControl(definition)}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </View>
  );
};
