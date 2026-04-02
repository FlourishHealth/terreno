import {Box, Button, MarkdownEditorField, SelectField, Text} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";

interface LocaleContentEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  title?: string;
  helperText?: string;
  errorText?: string;
}

const COMMON_LOCALES = [
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

export const LocaleContentEditor: React.FC<LocaleContentEditorProps> = ({
  value = {},
  onChange,
  title,
  helperText,
  errorText,
}) => {
  const entries = useMemo(
    () => (typeof value === "object" && value !== null ? value : {}),
    [value]
  );
  const locales = useMemo(() => Object.keys(entries), [entries]);
  const [activeLocale, setActiveLocale] = useState<string>(locales[0] ?? "en");
  const [newLocale, setNewLocale] = useState("");

  const availableLocales = useMemo(
    () => COMMON_LOCALES.filter((l) => !locales.includes(l.value)),
    [locales]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      onChange({...entries, [activeLocale]: content});
    },
    [entries, activeLocale, onChange]
  );

  const handleAddLocale = useCallback(() => {
    if (!newLocale || locales.includes(newLocale)) {
      return;
    }
    onChange({...entries, [newLocale]: ""});
    setActiveLocale(newLocale);
    setNewLocale("");
  }, [newLocale, locales, entries, onChange]);

  const handleRemoveLocale = useCallback(
    (locale: string) => {
      const updated = {...entries};
      delete updated[locale];
      onChange(updated);
      if (activeLocale === locale) {
        setActiveLocale(Object.keys(updated)[0] ?? "en");
      }
    },
    [entries, activeLocale, onChange]
  );

  return (
    <Box gap={2}>
      {title && (
        <Text bold size="md">
          {title}
        </Text>
      )}
      {helperText && (
        <Text color="secondaryDark" size="sm">
          {helperText}
        </Text>
      )}

      {locales.length > 0 && (
        <Box direction="row" gap={1} wrap>
          {locales.map((locale) => (
            <Button
              key={locale}
              onClick={() => setActiveLocale(locale)}
              text={COMMON_LOCALES.find((l) => l.value === locale)?.label ?? locale.toUpperCase()}
              variant={locale === activeLocale ? "primary" : "outline"}
            />
          ))}
        </Box>
      )}

      {locales.length > 0 && entries[activeLocale] !== undefined && (
        <Box gap={1}>
          <Box alignItems="center" direction="row" justifyContent="between">
            <Text color="secondaryDark" size="sm">
              Editing: {activeLocale}
            </Text>
            {locales.length > 1 && (
              <Button
                onClick={() => handleRemoveLocale(activeLocale)}
                text={`Remove ${activeLocale}`}
                variant="destructive"
              />
            )}
          </Box>
          <MarkdownEditorField
            onChange={handleContentChange}
            testID={`locale-content-${activeLocale}`}
            value={entries[activeLocale] ?? ""}
          />
        </Box>
      )}

      {locales.length === 0 && (
        <Text color="secondaryDark" size="sm">
          No content yet. Add a locale to get started.
        </Text>
      )}

      <Box alignItems="end" direction="row" gap={2}>
        <Box flex="grow">
          <SelectField
            onChange={setNewLocale}
            options={availableLocales}
            placeholder="Select locale..."
            value={newLocale}
          />
        </Box>
        <Button
          disabled={!newLocale}
          onClick={handleAddLocale}
          text="Add Locale"
          variant="outline"
        />
      </Box>

      {errorText && (
        <Text color="error" size="sm">
          {errorText}
        </Text>
      )}
    </Box>
  );
};
