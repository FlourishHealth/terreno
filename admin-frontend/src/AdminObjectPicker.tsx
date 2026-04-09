import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Spinner, Text, TextField} from "@terreno/ui";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";

interface AdminObjectPickerProps {
  api: Api<any, any, any, any>;
  routePath: string;
  refModelName: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  errorText?: string;
  helperText?: string;
}

const DISPLAY_FIELDS = ["name", "title", "email", "label", "displayName"];

const getDisplayValue = (item: any): string => {
  for (const field of DISPLAY_FIELDS) {
    if (item[field]) {
      return String(item[field]);
    }
  }
  return item._id ?? String(item);
};

const getSecondaryText = (item: any, primaryField: string): string | undefined => {
  for (const field of DISPLAY_FIELDS) {
    if (field !== primaryField && item[field]) {
      return String(item[field]);
    }
  }
  return undefined;
};

const getPrimaryField = (item: any): string => {
  for (const field of DISPLAY_FIELDS) {
    if (item[field]) {
      return field;
    }
  }
  return "_id";
};

export const AdminObjectPicker: React.FC<AdminObjectPickerProps> = ({
  api,
  routePath,
  refModelName,
  title,
  value,
  onChange,
  errorText,
  helperText,
}) => {
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Clear pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const searchEndpointKey = `adminSearch_${refModelName}`;
  const readEndpointKey = `adminSearchRead_${refModelName}`;

  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        [searchEndpointKey]: build.query({
          query: (q: string) => ({
            method: "GET",
            params: {q},
            url: `${routePath}/search`,
          }),
        }),
        [readEndpointKey]: build.query({
          query: (id: string) => ({
            method: "GET",
            url: `${routePath}/${id}`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, routePath, searchEndpointKey, readEndpointKey]);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const useSearchQuery = (enhancedApi as any)[`use${capitalize(searchEndpointKey)}Query`];
  const useReadQuery = (enhancedApi as any)[`use${capitalize(readEndpointKey)}Query`];

  const {data: searchData, isFetching: isSearching} = useSearchQuery(debouncedQuery, {
    skip: !debouncedQuery,
  });

  // Fetch the currently selected item to display its name
  const {data: selectedItem} = useReadQuery(value, {
    skip: !value,
  });

  // Update display when selected item loads
  useEffect(() => {
    if (selectedItem && value) {
      setSelectedDisplay(getDisplayValue(selectedItem));
    }
  }, [selectedItem, value]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    setIsOpen(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text);
    }, 300);
  }, []);

  const handleSelect = useCallback(
    (item: any) => {
      onChange(item._id);
      setSelectedDisplay(getDisplayValue(item));
      setSearchText("");
      setDebouncedQuery("");
      setIsOpen(false);
      setIsChanging(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange("");
    setSelectedDisplay("");
    setSearchText("");
    setDebouncedQuery("");
    setIsOpen(false);
    setIsChanging(false);
  }, [onChange]);

  const handleChange = useCallback(() => {
    setSearchText("");
    setDebouncedQuery("");
    setIsChanging(true);
    setIsOpen(true);
  }, []);

  const results = searchData?.data ?? [];

  return (
    <Box gap={1}>
      {value && selectedDisplay && !isChanging ? (
        <Box gap={1}>
          <TextField
            disabled
            helperText={helperText}
            onChange={() => {}}
            testID={`admin-picker-${refModelName}-display`}
            title={title}
            value={selectedDisplay}
          />
          <Box direction="row" gap={3}>
            <Box
              accessibilityHint="Clears the current selection"
              accessibilityLabel="Clear selection"
              onClick={handleClear}
              testID={`admin-picker-${refModelName}-clear`}
            >
              <Text color="primary" size="sm">
                Clear
              </Text>
            </Box>
            <Box
              accessibilityHint="Opens search to pick a different value"
              accessibilityLabel="Change selection"
              onClick={handleChange}
              testID={`admin-picker-${refModelName}-change`}
            >
              <Text color="primary" size="sm">
                Change
              </Text>
            </Box>
          </Box>
        </Box>
      ) : (
        <TextField
          errorText={errorText}
          helperText={isOpen ? "Type to search" : helperText}
          onChange={handleSearchChange}
          onFocus={() => setIsOpen(true)}
          testID={`admin-picker-${refModelName}-search`}
          title={title}
          value={searchText}
        />
      )}

      {isOpen && (
        <Box border="default" maxHeight={250} overflow="scrollY" rounding="md">
          {isSearching && (
            <Box alignItems="center" padding={3}>
              <Spinner />
            </Box>
          )}

          {!isSearching && debouncedQuery && results.length === 0 && (
            <Box padding={3}>
              <Text color="secondaryDark" size="sm">
                No results found
              </Text>
            </Box>
          )}

          {!isSearching &&
            results.map((item: any) => {
              const primaryField = getPrimaryField(item);
              const secondary = getSecondaryText(item, primaryField);
              return (
                <Box
                  accessibilityHint={`Selects ${getDisplayValue(item)}`}
                  accessibilityLabel={`Select ${getDisplayValue(item)}`}
                  key={item._id}
                  onClick={() => handleSelect(item)}
                  paddingX={3}
                  paddingY={2}
                  testID={`admin-picker-${refModelName}-result-${item._id}`}
                >
                  <Text size="sm">{getDisplayValue(item)}</Text>
                  {secondary && (
                    <Text color="secondaryDark" size="sm">
                      {secondary}
                    </Text>
                  )}
                </Box>
              );
            })}

          {!isSearching && !debouncedQuery && (
            <Box padding={3}>
              <Text color="secondaryDark" size="sm">
                Start typing to search
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
