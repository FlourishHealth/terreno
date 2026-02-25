import type {PasswordRequirement} from "./signUpTypes";

/**
 * Default password requirements with strong validation rules.
 */
export const defaultPasswordRequirements: PasswordRequirement[] = [
  {
    key: "minLength",
    label: "At least 8 characters",
    validate: (password: string) => password.length >= 8,
  },
  {
    key: "uppercase",
    label: "At least one uppercase letter",
    validate: (password: string) => /[A-Z]/.test(password),
  },
  {
    key: "lowercase",
    label: "At least one lowercase letter",
    validate: (password: string) => /[a-z]/.test(password),
  },
  {
    key: "number",
    label: "At least one number",
    validate: (password: string) => /\d/.test(password),
  },
  {
    key: "special",
    label: "At least one special character",
    validate: (password: string) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

/**
 * Simple password requirements with minimal validation.
 */
export const simplePasswordRequirements: PasswordRequirement[] = [
  {
    key: "minLength",
    label: "At least 6 characters",
    validate: (password: string) => password.length >= 6,
  },
];
