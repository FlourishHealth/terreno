import type {ReactNode} from "react";

import type {OAuthProviderConfig} from "../signUp/signUpTypes";

/**
 * Configuration for a login form field.
 */
export interface LoginFieldConfig {
  /** Unique field name used as the key in form state. */
  name: string;
  /** Display label for the field. */
  label: string;
  /** Placeholder text shown when the field is empty. */
  placeholder?: string;
  /** Input type for the field. */
  type?: "text" | "email" | "password";
  /** Whether the field is required. */
  required?: boolean;
  /** Auto-complete hint for the field. */
  autoComplete?: "current-password" | "on" | "off" | "username";
}

/**
 * Props for the LoginScreen component.
 */
export interface LoginScreenProps {
  /** Form field configurations. */
  fields: LoginFieldConfig[];
  /** Callback triggered on form submission. Receives field values as a record. */
  onSubmit: (values: Record<string, string>) => Promise<void>;
  /** Optional OAuth provider configurations for social login buttons. */
  oauthProviders?: OAuthProviderConfig[];
  /** Custom logo or banner to display above the form. */
  logo?: ReactNode;
  /** Title text for the login form. */
  title?: string;
  /** Whether the form is in a loading state. */
  loading?: boolean;
  /** Error message to display. */
  error?: string;
  /** Text for the link to navigate to sign up. */
  signUpLinkText?: string;
  /** Callback triggered when the sign-up link is pressed. */
  onSignUpPress?: () => void;
  /** Text for the forgot password link. */
  forgotPasswordText?: string;
  /** Callback triggered when the forgot password link is pressed. */
  onForgotPasswordPress?: () => void;
  /** Test ID for the root element. */
  testID?: string;
}
