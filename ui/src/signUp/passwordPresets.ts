import type {PasswordRequirement} from "./signUpTypes";

export const defaultPasswordRequirements: PasswordRequirement[] = [
  {
    id: "minLength",
    label: "At least 8 characters",
    validate: (password) => password.length >= 8,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    validate: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    validate: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "At least one number",
    validate: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "At least one special character",
    validate: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

export const simplePasswordRequirements: PasswordRequirement[] = [
  {
    id: "minLength",
    label: "At least 6 characters",
    validate: (password) => password.length >= 6,
  },
];
