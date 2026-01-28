import {type FC, useCallback, useEffect, useState} from "react";

import type {EmailFieldProps} from "./Common";
import {TextField} from "./TextField";

export const EmailField: FC<EmailFieldProps> = ({
  errorText,
  iconName,
  placeholder,
  value,
  onChange,
  onBlur,
  ...rest
}) => {
  const [localValue, setLocalValue] = useState<string>(value || "");
  const [localError, setLocalError] = useState<string | undefined>();

  // Sync local state with incoming prop values
  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const validateEmail = useCallback((email: string): string | undefined => {
    if (email.trim() === "") {
      return undefined;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Invalid email address format";
    }
    return undefined;
  }, []);

  const localOnChange = useCallback(
    (e: string) => {
      setLocalValue(e);
      const err = validateEmail(e);
      // remove error if valid email
      if (!err && Boolean(localError)) {
        setLocalError(undefined);
      }
      if (!err && onChange) {
        onChange(e);
      }
    },
    [onChange, validateEmail, localError]
  );

  const localOnBlur = useCallback(
    (e: string) => {
      const err = validateEmail(e);
      setLocalError(err);

      if (!err) {
        onBlur?.(e);
      }
    },
    [onBlur, validateEmail]
  );
  return (
    <TextField
      errorText={errorText ?? localError}
      iconName={iconName}
      onBlur={localOnBlur}
      onChange={localOnChange}
      placeholder={placeholder}
      type="email"
      value={localValue}
      {...rest}
    />
  );
};
