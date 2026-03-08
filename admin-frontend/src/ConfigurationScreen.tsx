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
import React, {useCallback, useEffect, useMemo, useState} from "react";
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

  // Secret fields show as password inputs
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

  // Default: string
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
  const {useMetaQuery, useValuesQuery, useUpdateMutation} = useConfigurationApi(api, basePath);

  const {data: meta, isLoading: isMetaLoading} = useMetaQuery();
  const {data: valuesResponse, isLoading: isValuesLoading} = useValuesQuery();
  const [updateConfig, {isLoading: isSaving}] = useUpdateMutation();

  const [formState, setFormState] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const toast = useToast();

  const configMeta = meta as ConfigurationMetaResponse | undefined;
  const configValues = valuesResponse?.data;

  // Initialize form state from fetched values
  useEffect(() => {
    if (configValues && configMeta && !isInitialized) {
      const initial: Record<string, any> = {};
      for (const section of configMeta.sections) {
        if (section.name === "__root__") {
          // General section fields are at the top level
          for (const [key, fieldMeta] of Object.entries(section.fields)) {
            initial[key] = configValues[key] ?? fieldMeta.default ?? "";
          }
        } else {
          // Nested section
          initial[section.name] = {};
          const sectionValues = configValues[section.name] ?? {};
          for (const [key, fieldMeta] of Object.entries(section.fields)) {
            initial[section.name][key] = sectionValues[key] ?? fieldMeta.default ?? "";
          }
        }
      }
      setFormState(initial);
      setIsInitialized(true);
    }
  }, [configValues, configMeta, isInitialized]);

  const handleFieldChange = useCallback((sectionName: string, fieldKey: string, value: any) => {
    setFormState((prev) => {
      if (sectionName === "general") {
        return {...prev, [fieldKey]: value};
      }
      return {
        ...prev,
        [sectionName]: {
          ...prev[sectionName],
          [fieldKey]: value,
        },
      };
    });
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await updateConfig(formState).unwrap();
      setIsDirty(false);
      toast.success("Configuration saved");
    } catch (err) {
      toast.catch(err, "Failed to save configuration");
    }
  }, [formState, updateConfig, toast]);

  const sections = useMemo(() => configMeta?.sections ?? [], [configMeta]);

  if (isMetaLoading || isValuesLoading) {
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
        {sections.map((section) => (
          <Card key={section.name} padding={4}>
            <Box gap={3}>
              <Box gap={1}>
                <Heading size="md">{section.displayName}</Heading>
                {section.description && (
                  <Text color="secondaryDark" size="sm">
                    {section.description}
                  </Text>
                )}
              </Box>
              {Object.entries(section.fields).map(([fieldKey, fieldMeta]) => (
                <ConfigField
                  fieldKey={fieldKey}
                  fieldMeta={fieldMeta}
                  key={fieldKey}
                  onChange={(value: any) => handleFieldChange(section.name, fieldKey, value)}
                  sectionName={section.name}
                  value={
                    section.name === "__root__"
                      ? formState[fieldKey]
                      : formState[section.name]?.[fieldKey]
                  }
                />
              ))}
            </Box>
          </Card>
        ))}
        {sections.length === 0 && (
          <Text color="secondaryDark">No configuration sections defined.</Text>
        )}
      </Box>
    </Page>
  );
};
