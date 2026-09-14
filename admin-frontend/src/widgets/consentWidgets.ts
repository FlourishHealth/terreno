import type {FieldWidgetComponent} from "../types";
import {
  CheckboxListFieldWidget,
  LocaleContentFieldWidget,
  LocaleDefaultFieldWidget,
} from "./builtInFieldWidgets";

/** Field widgets referenced by ConsentApp's contributed model configuration. */
export const CONSENT_ADMIN_WIDGETS: Record<string, FieldWidgetComponent> = {
  "checkbox-list": CheckboxListFieldWidget,
  "locale-content": LocaleContentFieldWidget,
  "locale-default": LocaleDefaultFieldWidget,
};
