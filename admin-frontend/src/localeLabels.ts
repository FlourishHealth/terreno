export interface LocaleOption {
  label: string;
  value: string;
}

export const COMMON_LOCALES: LocaleOption[] = [
  {label: "English", value: "en"},
  {label: "Spanish", value: "es"},
  {label: "French", value: "fr"},
  {label: "German", value: "de"},
  {label: "Portuguese", value: "pt"},
  {label: "Chinese", value: "zh"},
  {label: "Japanese", value: "ja"},
  {label: "Korean", value: "ko"},
  {label: "Arabic", value: "ar"},
  {label: "Hindi", value: "hi"},
];

const COMMON_LOCALE_LABELS = COMMON_LOCALES.reduce<Record<string, string>>((labels, locale) => {
  labels[locale.value] = locale.label;
  return labels;
}, {});

export const getLocaleLabel = (locale: string): string => {
  return COMMON_LOCALE_LABELS[locale] ?? locale.toUpperCase();
};

export const getLocaleOptions = (locales: string[]): LocaleOption[] => {
  return locales.map((locale) => ({
    label: getLocaleLabel(locale),
    value: locale,
  }));
};
