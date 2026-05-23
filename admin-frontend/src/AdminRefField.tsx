import React from "react";
import {AdminObjectPicker} from "./AdminObjectPicker";
import type {RefFieldRendererProps} from "./types";

/**
 * Props for the built-in {@link AdminRefField} renderer. Re-exported as the
 * shape custom ref renderers should accept (see {@link RefFieldRendererProps}).
 */
export type AdminRefFieldProps = RefFieldRendererProps;

export const AdminRefField: React.FC<RefFieldRendererProps> = ({
  api,
  routePath,
  refModelName,
  title,
  value,
  onChange,
  errorText,
  helperText,
}) => {
  return (
    <AdminObjectPicker
      api={api}
      errorText={errorText}
      helperText={helperText}
      onChange={onChange}
      refModelName={refModelName}
      routePath={routePath}
      title={title}
      value={value}
    />
  );
};
