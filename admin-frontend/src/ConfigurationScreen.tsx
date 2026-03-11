import type {Api} from "@reduxjs/toolkit/query/react";
import {
  BooleanField,
  Box,
  Button,
  Card,
  Heading,
  MarkdownEditorField,
  Page,
  Spinner,
  Text,
  TextField,
  useToast,
} from "@terreno/ui";
import startCase from "lodash/startCase";
import React, {useCallback, useMemo, useState} from "react";
import {useConfigurationApi} from "./useConfigurationApi";

interface ConfigFieldMeta {
  type: string;
  required: boolean;
  description?: string;
  enum?: string[];
  default?: any;
  secret?: boolean;
  widget?: string;
}

interface ConfigSectionMeta {
  name: string;
  displayName: string;
  description?: string;
  fields: Record<string, ConfigFieldMeta>;
}

interface ConfigurationMetaResponse {
  sections: ConfigSectionMeta[];
}

interface ConfigurationScreenProps {
  /** Base URL for configuration routes (e.g., "/configuration"). */
  basePath?: string;
  /** RTK Query API instance. */
  api: Api<any, any, any, any>;
  /** Optional title override. Defaults to "Configuration". */
  title?: string;
}

/**
 * Renders a single configuration field based on its metadata.
 */
const ConfigField: React.FC<{
  fieldKey: string;
  fieldMeta: ConfigFieldMeta;
  value: any;
  onChange: (value: any) => void;
  sectionName: string;
}> = ({fieldKey, fieldMeta, value, onChange, sectionName}) => {
  const label = startCase(fieldKey);
  const helperText = fieldMeta.description;
  const testID = `config-${sectionName}-${fieldKey}`;

  if (fieldMeta.type === "boolean") {
    return (
      <BooleanField
        helperText={helperText}
        onChange={onChange}
        title={label}
        value={value ?? fieldMeta.default ?? false}
      />
    );
  }

  if (fieldMeta.type === "number") {
    return (
      <TextField
        helperText={helperText}
        onChange={(text: string) => {
          const num = Number(text);
          onChange(Number.isNaN(num) ? text : num);
        }}
        testID={testID}
        title={label}
        value={value != null ? String(value) : ""}
      />
    );
  }

  if (fieldMeta.widget === "markdown") {
    return (
      <MarkdownEditorField
        helperText={helperText}
        onChange={onChange}
        testID={testID}
        title={label}
        value={value ?? ""}
      />
    );
  }

  if (fieldMeta.secret) {
    return (
      <TextField
        helperText={helperText ? `${helperText} (secret)` : "Secret value"}
        onChange={onChange}
        testID={testID}
        title={`${label} (Secret)`}
        type="password"
        value={value ?? ""}
      />
    );
  }

  return (
    <TextField
      helperText={helperText}
      onChange={onChange}
      testID={testID}
      title={label}
      value={value ?? ""}
    />
  );
};

const SectionDescription: React.FC<{description: string}> = ({description}) => (
  <Text color="secondaryDark" size="sm">
    {description}
  </Text>
);

const SectionCard: React.FC<{
  section: ConfigSectionMeta;
  formState: Record<string, any>;
  onFieldChange: (sectionName: string, fieldKey: string, value: any) => void;
}> = ({section, formState, onFieldChange}) => {
  const sectionValues = section.name === "__root__" ? formState : (formState[section.name] ?? {});
  return (
    <Card padding={4}>
      <Box gap={3}>
        <Box gap={1}>
          <Heading size="md">{section.displayName}</Heading>
          {section.description && <SectionDescription description={section.description} />}
        </Box>
        {Object.entries(section.fields).map(([fieldKey, fieldMeta]) => (
          <ConfigField
            fieldKey={fieldKey}
            fieldMeta={fieldMeta}
            key={fieldKey}
            onChange={(value: any) => onFieldChange(section.name, fieldKey, value)}
            sectionName={section.name}
            value={sectionValues[fieldKey]}
          />
        ))}
      </Box>
    </Card>
  );
};

const EmptySections: React.FC = () => (
  <Text color="secondaryDark">No configuration sections defined.</Text>
);

/**
 * Configuration management screen that auto-generates a form from the backend
 * configuration model's schema metadata.
 *
 * Fetches metadata from `{basePath}/meta` and current values from `{basePath}`.
 * Each nested subschema in the configuration model renders as a separate card/section.
 * Supports string, number, boolean, and secret field types.
 *
 * @example
 * ```typescript
 * import {ConfigurationScreen} from "@terreno/admin-frontend";
 * import {api} from "@/store/openApiSdk";
 *
 * export default function ConfigScreen() {
 *   return <ConfigurationScreen api={api} />;
 * }
 * ```
 */
export const ConfigurationScreen: React.FC<ConfigurationScreenProps> = ({
  basePath = "/configuration",
  api,
  title = "Configuration",
}) => {
  const {useMetaQuery, useValuesQuery, useUpdateMutation} = useConfigurationApi({api, basePath});

  const {data: meta, isLoading: isMetaLoading} = useMetaQuery();
  const {data: valuesResponse, isLoading: isValuesLoading} = useValuesQuery();
  const [updateConfig, {isLoading: isSaving}] = useUpdateMutation();

  // Tracks only the fields the user has explicitly edited. null = no edits yet.
  const [userEdits, setUserEdits] = useState<Record<string, any> | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const toast = useToast();

  const configMeta = meta as ConfigurationMetaResponse | undefined;
  const configValues = valuesResponse?.data;

  // Derived synchronously so the form is never blank when data is already cached.
  const serverValues = useMemo((): Record<string, any> => {
    if (!configValues || !configMeta) return {};
    const initial: Record<string, any> = {};
    for (const section of configMeta.sections) {
      if (section.name === "__root__") {
        for (const [key, fieldMeta] of Object.entries(section.fields)) {
          initial[key] = configValues[key] ?? fieldMeta.default ?? "";
        }
      } else {
        initial[section.name] = {};
        const sectionValues = (configValues[section.name] as Record<string, any>) ?? {};
        for (const [key, fieldMeta] of Object.entries(section.fields)) {
          initial[section.name][key] = sectionValues[key] ?? fieldMeta.default ?? "";
        }
      }
    }
    return initial;
  }, [configValues, configMeta]);

  const formState = userEdits ?? serverValues;

  const handleFieldChange = useCallback(
    (sectionName: string, fieldKey: string, value: any) => {
      setIsDirty(true);
      setUserEdits((prev) => {
        const base = prev ?? serverValues;
        if (sectionName === "__root__") {
          return {...base, [fieldKey]: value};
        }
        return {
          ...base,
          [sectionName]: {
            ...(base[sectionName] as Record<string, any>),
            [fieldKey]: value,
          },
        };
      });
    },
    [serverValues]
  );

  const handleSave = useCallback(async () => {
    try {
      await updateConfig(formState).unwrap();
      // Keep userEdits so the form continues to show the saved values while
      // the cache invalidation refetch runs in the background.
      setIsDirty(false);
      toast.success("Configuration saved");
    } catch (err) {
      toast.catch(err, "Failed to save configuration");
    }
  }, [formState, updateConfig, toast]);

  const sections = useMemo(() => configMeta?.sections ?? [], [configMeta]);

  // Only block rendering on the very first load (no cached data yet).
  // Background refetches (e.g. after a save) should not show a spinner.
  const isInitialLoading = (isMetaLoading && !configMeta) || (isValuesLoading && !configValues);
  if (isInitialLoading) {
    return (
      <Page maxWidth="100%" title={title}>
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (!configMeta) {
    return (
      <Page maxWidth="100%" title={title}>
        <Box padding={4}>
          <Text color="secondaryDark">No configuration metadata available.</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page
      footer={
        <Box direction="row" justifyContent="end" padding={2}>
          <Button
            disabled={!isDirty}
            loading={isSaving}
            onClick={handleSave}
            testID="config-save-button"
            text="Save Configuration"
            variant="primary"
          />
        </Box>
      }
      maxWidth={800}
      scroll
      title={title}
    >
      <Box gap={4} padding={4}>
        {sections.length === 0 ? (
          <EmptySections />
        ) : (
          sections.map((section) => (
            <SectionCard
              formState={formState}
              key={section.name}
              onFieldChange={handleFieldChange}
              section={section}
            />
          ))
        )}
      </Box>
    </Page>
  );
};
