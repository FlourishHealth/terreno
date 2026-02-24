import type {Api} from "@reduxjs/toolkit/query/react";
import {SelectField} from "@terreno/ui";
import React, {useMemo} from "react";

interface AdminRefFieldProps {
  api: Api<any, any, any, any>;
  baseUrl: string;
  routePath: string;
  refModelName: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  errorText?: string;
  helperText?: string;
}

// Heuristic to find a display field from an item
const getDisplayValue = (item: any): string => {
  for (const field of ["name", "title", "email", "label", "displayName"]) {
    if (item[field]) {
      return String(item[field]);
    }
  }
  return item._id ?? String(item);
};

export const AdminRefField: React.FC<AdminRefFieldProps> = ({
  api,
  routePath,
  refModelName,
  title,
  value,
  onChange,
  errorText,
  helperText,
}) => {
  const endpointKey = `adminRefList_${refModelName}`;

  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        [endpointKey]: build.query({
          query: () => ({
            method: "GET",
            params: {limit: 100},
            url: routePath,
          }),
        }),
      }),
      overrideExisting: false,
    });
  }, [api, routePath, endpointKey]);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const useRefQuery = (enhancedApi as any)[`use${capitalize(endpointKey)}Query`];
  const {data, isLoading} = useRefQuery();

  const options = useMemo(() => {
    if (!data?.data) {
      return [];
    }
    return data.data.map((item: any) => ({
      label: getDisplayValue(item),
      value: item._id,
    }));
  }, [data]);

  return (
    <SelectField
      disabled={isLoading}
      errorText={errorText}
      helperText={helperText}
      onChange={onChange}
      options={options}
      title={title}
      value={value}
    />
  );
};
