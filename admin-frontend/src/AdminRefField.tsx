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

/**
 * Select field for choosing a referenced model instance by ID.
 *
 * Fetches all items from the referenced model and displays them in a dropdown.
 * Automatically determines a display label by checking common fields (name, title, email, etc.).
 * Falls back to the item's _id if no suitable display field is found.
 *
 * @param props - Component props
 * @param props.api - RTK Query API instance for fetching reference data
 * @param props.baseUrl - Base URL for admin routes (not currently used, kept for consistency)
 * @param props.routePath - Full route path to the referenced model's list endpoint
 * @param props.refModelName - Name of the referenced model (e.g., "User")
 * @param props.title - Label displayed above the select field
 * @param props.value - Currently selected ID
 * @param props.onChange - Callback when selection changes
 * @param props.errorText - Optional validation error message
 * @param props.helperText - Optional helper text shown below the field
 *
 * @example
 * ```typescript
 * <AdminRefField
 *   api={api}
 *   baseUrl="/admin"
 *   routePath="/admin/users"
 *   refModelName="User"
 *   title="Owner"
 *   value={ownerId}
 *   onChange={(id) => setOwnerId(id)}
 *   helperText="Select the user who owns this item"
 * />
 * ```
 *
 * @see AdminFieldRenderer for field type selection
 * @see useAdminApi for the API hook pattern
 */
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
      overrideExisting: true,
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
