import type {ReactNode} from "react";
import type {ImageSourcePropType} from "react-native";

import type {IconName} from "../Common";

export type SignUpFieldType = "email" | "password" | "phoneNumber" | "search" | "text" | "url";

export interface SignUpFieldConfig {
  name: string;
  title: string;
  type: SignUpFieldType;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  validate?: (value: string, allValues: Record<string, string>) => string | undefined;
}

export interface PasswordRequirement {
  id: string;
  label: string;
  validate: (password: string) => boolean;
}

export interface PasswordRequirementsConfig {
  requirements: PasswordRequirement[];
  showOnFocus?: boolean;
  showCheckmarks?: boolean;
}

export interface OnboardingPage {
  id: string;
  renderContent?: () => ReactNode;
  logoSource?: ImageSourcePropType;
  header?: string;
  subheader?: string;
}

export interface OAuthProviderConfig {
  provider: string;
  label: string;
  iconName?: IconName;
  enabled: boolean;
  onPress?: () => void | Promise<void>;
}

export interface SignUpScreenProps {
  logo?: {source: ImageSourcePropType; width?: number; height?: number};
  bannerComponent?: ReactNode;

  fields: SignUpFieldConfig[];
  passwordRequirements?: PasswordRequirementsConfig;

  oauthProviders?: OAuthProviderConfig[];
  oauthDividerText?: string;

  onboardingPages?: OnboardingPage[];
  showOnboardingFirst?: boolean;

  submitButtonText?: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onLoginPress?: () => void;
  loginLinkText?: string;

  isLoading?: boolean;
  error?: string;
}

export interface SwiperProps {
  pages: OnboardingPage[];
  onComplete: () => void;
  skipText?: string;
  nextText?: string;
  getStartedText?: string;
}

export interface PasswordRequirementsDisplayProps {
  requirements: PasswordRequirement[];
  password: string;
  showCheckmarks?: boolean;
  visible: boolean;
}

export interface OAuthButtonsProps {
  providers: OAuthProviderConfig[];
  dividerText?: string;
}
