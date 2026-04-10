import type {Api} from "@reduxjs/toolkit/query/react";
import React from "react";
import {AdminObjectPicker} from "./AdminObjectPicker";

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
