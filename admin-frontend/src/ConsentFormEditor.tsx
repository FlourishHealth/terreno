import {
  BooleanField,
  Box,
  Button,
  Heading,
  MarkdownEditor,
  Modal,
  MultiselectField,
  NumberField,
  Page,
  SegmentedControl,
  SelectField,
  Spinner,
  Text,
  TextField,
  useToast,
} from "@terreno/ui";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {getLocaleLabel, getLocaleOptions} from "./localeLabels";
import type {AdminApi, EndpointBuilder} from "./types";
import {useAdminApi} from "./useAdminApi";

interface CheckboxConfig {
  label: string;
  required: boolean;
  confirmationPrompt?: string;
}

/** Consent form document — shape comes from the consumer's Mongoose model. */
interface ConsentFormDocument {
  _id?: string;
  title?: string;
  slug?: string;
  type?: string;
  order?: number;
  required?: boolean;
  active?: boolean;
  captureSignature?: boolean;
  requireScrollToBottom?: boolean;
  defaultLocale?: string;
  agreeButtonText?: string;
  allowDecline?: boolean;
  declineButtonText?: string;
  content?: Record<string, string>;
  checkboxes?: CheckboxConfig[];
  [key: string]: unknown;
}

interface ConsentFormEditorProps {
  baseUrl: string;
  api: AdminApi;
  id?: string;
  supportedLocales?: string[];
  hasAiSupport?: boolean;
  onSave?: (form: ConsentFormDocument | undefined) => void;
  onCancel?: () => void;
}

const CONSENT_FORM_ROUTE = "/consent-forms";

const TYPE_OPTIONS = [
  {label: "Agreement", value: "agreement"},
  {label: "Privacy", value: "privacy"},
  {label: "HIPAA", value: "hipaa"},
  {label: "Research", value: "research"},
  {label: "Terms", value: "terms"},
  {label: "Custom", value: "custom"},
];

const DEFAULT_SUPPORTED_LOCALES = ["en"];

const areStringArraysEqual = (first: string[], second: string[]): boolean => {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((value, index) => value === second[index]);
};

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const ConsentFormEditor: React.FC<ConsentFormEditorProps> = ({
  baseUrl,
  api,
  id,
  supportedLocales = DEFAULT_SUPPORTED_LOCALES,
  hasAiSupport = false,
  onSave,
  onCancel,
}) => {
  const isEditMode = Boolean(id);
  const toast = useToast();

  // Basic fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallySet, setSlugManuallySet] = useState(false);
  const [type, setType] = useState("agreement");
  const [order, setOrder] = useState("0");
  const [required, setRequired] = useState(false);
  const [active, setActive] = useState(true);

  // Form behavior
  const [captureSignature, setCaptureSignature] = useState(false);
  const [requireScrollToBottom, setRequireScrollToBottom] = useState(false);

  // Locale config
  const [defaultLocale, setDefaultLocale] = useState(supportedLocales[0] ?? "en");

  // Button config
  const [agreeButtonText, setAgreeButtonText] = useState("I Agree");
  const [allowDecline, setAllowDecline] = useState(false);
  const [declineButtonText, setDeclineButtonText] = useState("Decline");

  // Content per locale
  const [localeContent, setLocaleContent] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const locale of supportedLocales) {
      initial[locale] = "";
    }
    return initial;
  });
  const [activeLocaleIndex, setActiveLocaleIndex] = useState(0);

  // Checkboxes
  const [checkboxes, setCheckboxes] = useState<CheckboxConfig[]>([]);

  // AI state
  const [isGenerateModalVisible, setIsGenerateModalVisible] = useState(false);
  const [generateDescription, setGenerateDescription] = useState("");
  const [generateType, setGenerateType] = useState(type);
  const [isAutoTranslateEnabled, setIsAutoTranslateEnabled] = useState(false);
  const [translationTargetLocales, setTranslationTargetLocales] = useState<string[]>(() =>
    supportedLocales.filter((locale) => locale !== defaultLocale)
  );

  const routePath = `${baseUrl}${CONSENT_FORM_ROUTE}`;
  // publish/generate/translate are registered directly under /consent-forms, not the admin base path
  const consentApiPath = CONSENT_FORM_ROUTE;

  const {useReadQuery, useCreateMutation, useUpdateMutation} = useAdminApi(
    api,
    routePath,
    "ConsentForm"
  );

  const enhancedApi = useMemo(
    () =>
      api.injectEndpoints({
        endpoints: (build: EndpointBuilder) => ({
          generateConsentContent: build.mutation({
            query: (body: {type: string; description: string; locale: string}) => ({
              body,
              method: "POST",
              url: `${consentApiPath}/generate`,
            }),
          }),
          publishConsentForm: build.mutation({
            query: (formId: string) => ({
              method: "POST",
              url: `${consentApiPath}/${formId}/publish`,
            }),
          }),
          translateConsentContent: build.mutation({
            query: (body: {content: string; fromLocale: string; toLocale: string}) => ({
              body,
              method: "POST",
              url: `${consentApiPath}/translate`,
            }),
          }),
        }),
        overrideExisting: true,
      }),
    [api, consentApiPath]
  );

  // biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
  const enhanced = enhancedApi as any;
  const [publishConsentForm, {isLoading: isPublishing}] = enhanced.usePublishConsentFormMutation();
  const [generateContent, {isLoading: isGenerating}] = enhanced.useGenerateConsentContentMutation();
  const [translateContent, {isLoading: isTranslating}] =
    enhanced.useTranslateConsentContentMutation();

  const {data: formData, isLoading: isFormLoading} = useReadQuery(id ?? "", {
    skip: !isEditMode || !id,
  });

  const [createForm, {isLoading: isCreating}] = useCreateMutation();
  const [updateForm, {isLoading: isUpdating}] = useUpdateMutation();

  // Populate form state when editing an existing form
  useEffect(() => {
    if (!formData) {
      return;
    }
    setTitle(formData.title ?? "");
    setSlug(formData.slug ?? "");
    setSlugManuallySet(true);
    setType(formData.type ?? "agreement");
    setGenerateType(formData.type ?? "agreement");
    setOrder(String(formData.order ?? 0));
    setRequired(formData.required ?? false);
    setActive(formData.active ?? true);
    setCaptureSignature(formData.captureSignature ?? false);
    setRequireScrollToBottom(formData.requireScrollToBottom ?? false);
    setDefaultLocale(formData.defaultLocale ?? supportedLocales[0] ?? "en");
    setAgreeButtonText(formData.agreeButtonText ?? "I Agree");
    setAllowDecline(formData.allowDecline ?? false);
    setDeclineButtonText(formData.declineButtonText ?? "Decline");

    if (formData.content && typeof formData.content === "object") {
      const newLocaleContent: Record<string, string> = {};
      for (const locale of supportedLocales) {
        newLocaleContent[locale] = formData.content[locale] ?? "";
      }
      setLocaleContent(newLocaleContent);
    }

    if (Array.isArray(formData.checkboxes)) {
      setCheckboxes(formData.checkboxes);
    }
  }, [formData, supportedLocales]);

  // Keep the GPT target list valid when the available or default locale changes.
  useEffect(() => {
    const availableTargetLocales = supportedLocales.filter((locale) => locale !== defaultLocale);
    setTranslationTargetLocales((prev) => {
      const validTargets = prev.filter((locale) => availableTargetLocales.includes(locale));
      if (validTargets.length > 0) {
        if (areStringArraysEqual(prev, validTargets)) {
          return prev;
        }
        return validTargets;
      }
      if (areStringArraysEqual(prev, availableTargetLocales)) {
        return prev;
      }
      return availableTargetLocales;
    });
  }, [defaultLocale, supportedLocales]);

  // Auto-generate slug from title unless manually set
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      if (!slugManuallySet) {
        setSlug(slugify(newTitle));
      }
    },
    [slugManuallySet]
  );

  const handleSlugChange = useCallback((newSlug: string) => {
    setSlug(newSlug);
    setSlugManuallySet(true);
  }, []);

  const handleLocaleContentChange = useCallback((locale: string, content: string) => {
    setLocaleContent((prev) => ({...prev, [locale]: content}));
  }, []);

  const handleAddCheckbox = useCallback(() => {
    setCheckboxes((prev) => [...prev, {confirmationPrompt: "", label: "", required: false}]);
  }, []);

  const handleRemoveCheckbox = useCallback((index: number) => {
    setCheckboxes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCheckboxChange = useCallback(
    (index: number, field: keyof CheckboxConfig, value: string | boolean) => {
      setCheckboxes((prev) => {
        const updated = [...prev];
        updated[index] = {...updated[index], [field]: value};
        return updated;
      });
    },
    []
  );

  const buildPayload = useCallback(
    (contentOverride?: Record<string, string>) => {
      return {
        active,
        agreeButtonText,
        allowDecline,
        captureSignature,
        checkboxes: checkboxes.map((cb) => ({
          confirmationPrompt: cb.confirmationPrompt || undefined,
          label: cb.label,
          required: cb.required,
        })),
        content: contentOverride ?? localeContent,
        declineButtonText: allowDecline ? declineButtonText : undefined,
        defaultLocale,
        order: parseInt(order, 10) || 0,
        required,
        requireScrollToBottom,
        slug,
        title,
        type,
      };
    },
    [
      active,
      agreeButtonText,
      allowDecline,
      captureSignature,
      checkboxes,
      defaultLocale,
      localeContent,
      declineButtonText,
      order,
      required,
      requireScrollToBottom,
      slug,
      title,
      type,
    ]
  );

  const translateLocales = useCallback(
    async ({
      sourceContent,
      startingContent,
      targetLocales,
    }: {
      sourceContent: string;
      startingContent: Record<string, string>;
      targetLocales: string[];
    }): Promise<Record<string, string> | undefined> => {
      if (!sourceContent.trim()) {
        toast.error(`No content in ${getLocaleLabel(defaultLocale)} to translate from`);
        return undefined;
      }

      if (targetLocales.length === 0) {
        toast.error("Select at least one language to translate into");
        return undefined;
      }

      let translatedContent = {...startingContent};
      for (const targetLocale of targetLocales) {
        if (targetLocale === defaultLocale) {
          continue;
        }

        try {
          const result = await translateContent({
            content: sourceContent,
            fromLocale: defaultLocale,
            toLocale: targetLocale,
          }).unwrap();
          translatedContent = {
            ...translatedContent,
            [targetLocale]: result?.data?.content ?? "",
          };
        } catch (err) {
          toast.catch(err, `Failed to translate content to ${getLocaleLabel(targetLocale)}`);
          return undefined;
        }
      }

      setLocaleContent(translatedContent);
      return translatedContent;
    },
    [defaultLocale, toast, translateContent]
  );

  const handleTranslateSelectedLocales = useCallback(async (): Promise<
    Record<string, string> | undefined
  > => {
    const sourceContent = localeContent[defaultLocale] ?? "";
    const translatedContent = await translateLocales({
      sourceContent,
      startingContent: localeContent,
      targetLocales: translationTargetLocales,
    });

    if (!translatedContent) {
      return undefined;
    }

    toast.success(`Translated into ${translationTargetLocales.length} language(s)`);
    return translatedContent;
  }, [defaultLocale, localeContent, toast, translateLocales, translationTargetLocales]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    let nextLocaleContent = localeContent;
    if (hasAiSupport && isAutoTranslateEnabled) {
      const translatedContent = await handleTranslateSelectedLocales();
      if (!translatedContent) {
        return;
      }
      nextLocaleContent = translatedContent;
    }

    const payload = buildPayload(nextLocaleContent);

    try {
      let result: ConsentFormDocument | undefined;
      if (isEditMode && id) {
        result = (await updateForm({body: payload, id}).unwrap()) as ConsentFormDocument;
      } else {
        result = (await createForm(payload).unwrap()) as ConsentFormDocument;
      }
      console.info("Consent form saved", {id: result?._id ?? id});
      onSave?.(result);
    } catch (err) {
      toast.catch(err, `Failed to ${isEditMode ? "update" : "create"} consent form`);
    }
  }, [
    buildPayload,
    createForm,
    handleTranslateSelectedLocales,
    hasAiSupport,
    id,
    isAutoTranslateEnabled,
    isEditMode,
    localeContent,
    onSave,
    slug,
    title,
    toast,
    updateForm,
  ]);

  const handlePublish = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      await publishConsentForm(id).unwrap();
      console.info("Consent form published", {id});
      toast.success("New version published");
    } catch (err) {
      toast.catch(err, "Failed to publish consent form");
    }
  }, [id, publishConsentForm, toast]);

  const handleOpenGenerateModal = useCallback(() => {
    setGenerateType(type);
    setGenerateDescription("");
    setIsGenerateModalVisible(true);
  }, [type]);

  const handleGenerate = useCallback(async () => {
    const activeLocale = supportedLocales[activeLocaleIndex] ?? "en";
    try {
      const result = await generateContent({
        description: generateDescription,
        locale: activeLocale,
        type: generateType,
      }).unwrap();
      const generatedText = result?.data?.content ?? "";
      const nextLocaleContent = {...localeContent, [activeLocale]: generatedText};
      setLocaleContent(nextLocaleContent);
      if (isAutoTranslateEnabled && activeLocale === defaultLocale) {
        await translateLocales({
          sourceContent: generatedText,
          startingContent: nextLocaleContent,
          targetLocales: translationTargetLocales,
        });
      }
      setIsGenerateModalVisible(false);
      toast.success("Content generated successfully");
    } catch (err) {
      toast.catch(err, "Failed to generate content");
    }
  }, [
    activeLocaleIndex,
    defaultLocale,
    generateContent,
    generateDescription,
    generateType,
    isAutoTranslateEnabled,
    localeContent,
    supportedLocales,
    toast,
    translateLocales,
    translationTargetLocales,
  ]);

  const handleTranslate = useCallback(
    async (targetLocale: string) => {
      const sourceContent = localeContent[defaultLocale] ?? "";
      const translatedContent = await translateLocales({
        sourceContent,
        startingContent: localeContent,
        targetLocales: [targetLocale],
      });

      if (translatedContent) {
        toast.success(`Content translated to ${getLocaleLabel(targetLocale)}`);
      }
    },
    [defaultLocale, localeContent, toast, translateLocales]
  );

  // Hooks must run before any early returns to keep React's hook order stable across
  // the loading → loaded transition (otherwise: "Rendered more hooks than during the
  // previous render", React error #310).
  const contentLocales = useMemo(
    () => Object.keys(localeContent).filter((k) => localeContent[k] !== undefined),
    [localeContent]
  );
  const defaultLocaleOptions = useMemo(() => getLocaleOptions(contentLocales), [contentLocales]);
  const localeSegmentItems = useMemo(
    () => supportedLocales.map((locale) => getLocaleLabel(locale)),
    [supportedLocales]
  );
  const translationTargetOptions = useMemo(
    () => getLocaleOptions(supportedLocales.filter((locale) => locale !== defaultLocale)),
    [defaultLocale, supportedLocales]
  );

  if (isEditMode && isFormLoading) {
    return (
      <Page maxWidth="100%">
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  const isSaving = isCreating || isUpdating;
  const activeLocale = supportedLocales[activeLocaleIndex] ?? "en";
  const isNonDefaultLocale = activeLocale !== defaultLocale;
  const hasLocales = contentLocales.length > 0;

  return (
    <Page
      footer={
        <Box direction="row" gap={2} justifyContent="between" padding={2}>
          <Box>
            {onCancel && (
              <Button
                onClick={onCancel}
                testID="consent-form-cancel-button"
                text="Cancel"
                variant="secondary"
              />
            )}
          </Box>
          <Button
            loading={isSaving}
            onClick={handleSave}
            testID="consent-form-save-button"
            text={isEditMode ? "Save" : "Create"}
            variant="primary"
          />
        </Box>
      }
      maxWidth="100%"
      scroll
    >
      <Box gap={4} padding={4}>
        {isEditMode && (
          <Box alignItems="center" direction="row" justifyContent="between">
            <Heading size="md">{title || "Edit Consent Form"}</Heading>
            <Box direction="row" gap={2}>
              {hasAiSupport && (
                <Button
                  iconName="wand-magic-sparkles"
                  loading={isGenerating}
                  onClick={handleOpenGenerateModal}
                  testID="consent-form-generate-button"
                  text="Generate with AI"
                  variant="secondary"
                />
              )}
              <Button
                loading={isPublishing}
                onClick={handlePublish}
                testID="consent-form-publish-button"
                text="Publish New Version"
                variant="primary"
              />
            </Box>
          </Box>
        )}

        {/* Basic Fields */}
        <Box gap={3}>
          <Heading size="sm">Basic Information</Heading>
          <TextField
            onChange={handleTitleChange}
            placeholder="Form title"
            testID="consent-form-title-input"
            title="Title"
            value={title}
          />
          <TextField
            onChange={handleSlugChange}
            placeholder="form-slug"
            testID="consent-form-slug-input"
            title="Slug"
            value={slug}
          />
          <SelectField
            onChange={setType}
            options={TYPE_OPTIONS}
            requireValue
            title="Type"
            value={type}
          />
          <NumberField
            onChange={setOrder}
            testID="consent-form-order-input"
            title="Order"
            type="number"
            value={order}
          />
          <SelectField
            disabled={!hasLocales}
            helperText={
              hasLocales
                ? undefined
                : "Add at least one locale with content before setting a default locale."
            }
            onChange={setDefaultLocale}
            options={defaultLocaleOptions}
            title="Default Locale"
            value={defaultLocale}
          />
          <BooleanField onChange={setRequired} title="Required" value={required} variant="title" />
          <BooleanField onChange={setActive} title="Active" value={active} variant="title" />
        </Box>

        {/* Form Behavior */}
        <Box gap={3}>
          <Heading size="sm">Form Behavior</Heading>
          <BooleanField
            onChange={setCaptureSignature}
            title="Capture Signature"
            value={captureSignature}
            variant="title"
          />
          <BooleanField
            onChange={setRequireScrollToBottom}
            title="Require Scroll to Bottom"
            value={requireScrollToBottom}
            variant="title"
          />
        </Box>

        {/* Button Config */}
        <Box gap={3}>
          <Heading size="sm">Button Configuration</Heading>
          <TextField
            onChange={setAgreeButtonText}
            placeholder="I Agree"
            testID="consent-form-agree-button-text-input"
            title="Agree Button Text"
            value={agreeButtonText}
          />
          <BooleanField
            onChange={setAllowDecline}
            title="Allow Decline"
            value={allowDecline}
            variant="title"
          />
          {allowDecline && (
            <TextField
              onChange={setDeclineButtonText}
              placeholder="Decline"
              testID="consent-form-decline-button-text-input"
              title="Decline Button Text"
              value={declineButtonText}
            />
          )}
        </Box>

        {/* Content per Locale */}
        <Box gap={3}>
          <Box alignItems="center" direction="row" justifyContent="between">
            <Heading size="sm">Content</Heading>
            {hasAiSupport && !isEditMode && (
              <Button
                iconName="wand-magic-sparkles"
                loading={isGenerating}
                onClick={handleOpenGenerateModal}
                testID="consent-form-generate-button"
                text="Generate with AI"
                variant="secondary"
              />
            )}
          </Box>
          {supportedLocales.length > 1 && (
            <SegmentedControl
              items={localeSegmentItems}
              onChange={setActiveLocaleIndex}
              selectedIndex={activeLocaleIndex}
            />
          )}
          {hasAiSupport && supportedLocales.length > 1 && (
            <Box border="default" gap={3} padding={3} rounding="md">
              <BooleanField
                helperText={`Use GPT to translate from ${getLocaleLabel(defaultLocale)} into selected languages before saving.`}
                onChange={setIsAutoTranslateEnabled}
                title="Auto translate with GPT"
                value={isAutoTranslateEnabled}
                variant="title"
              />
              {isAutoTranslateEnabled && (
                <Box gap={3}>
                  <MultiselectField
                    helperText="Choose every language this consent form should include."
                    onChange={setTranslationTargetLocales}
                    options={translationTargetOptions}
                    title="Translate into"
                    value={translationTargetLocales}
                  />
                  <Button
                    disabled={translationTargetLocales.length === 0}
                    loading={isTranslating}
                    onClick={async () => {
                      await handleTranslateSelectedLocales();
                    }}
                    testID="consent-form-translate-selected-button"
                    text="Translate Selected Languages"
                    variant="secondary"
                  />
                </Box>
              )}
            </Box>
          )}
          {hasAiSupport && isNonDefaultLocale && (
            <Box>
              <Button
                loading={isTranslating}
                onClick={() => handleTranslate(activeLocale)}
                testID={`consent-form-translate-${activeLocale}-button`}
                text={`Translate from ${getLocaleLabel(defaultLocale)}`}
                variant="secondary"
              />
            </Box>
          )}
          <MarkdownEditor
            onChange={(content: string) => handleLocaleContentChange(activeLocale, content)}
            placeholder={`Enter content for ${getLocaleLabel(activeLocale)}`}
            testID={`consent-form-content-${activeLocale}`}
            title={
              supportedLocales.length > 1 ? `Content (${getLocaleLabel(activeLocale)})` : "Content"
            }
            value={localeContent[activeLocale] ?? ""}
          />
        </Box>

        {/* Checkbox Builder */}
        <Box gap={3}>
          <Box alignItems="center" direction="row" justifyContent="between">
            <Heading size="sm">Checkboxes</Heading>
            <Button
              iconName="plus"
              onClick={handleAddCheckbox}
              testID="consent-form-add-checkbox-button"
              text="Add Checkbox"
              variant="secondary"
            />
          </Box>
          {checkboxes.length === 0 && <Text color="secondaryDark">No checkboxes configured.</Text>}
          {checkboxes.map((checkbox, index) => (
            <Box
              border="default"
              gap={3}
              key={index}
              padding={3}
              rounding="md"
              testID={`consent-form-checkbox-${index}`}
            >
              <Box alignItems="center" direction="row" justifyContent="between">
                <Heading size="sm">Checkbox {index + 1}</Heading>
                <Button
                  iconName="trash"
                  onClick={() => handleRemoveCheckbox(index)}
                  testID={`consent-form-checkbox-${index}-remove-button`}
                  text="Remove"
                  variant="destructive"
                />
              </Box>
              <TextField
                onChange={(value: string) => handleCheckboxChange(index, "label", value)}
                placeholder="Checkbox label"
                testID={`consent-form-checkbox-${index}-label-input`}
                title="Label"
                value={checkbox.label}
              />
              <BooleanField
                onChange={(value: boolean) => handleCheckboxChange(index, "required", value)}
                title="Required"
                value={checkbox.required}
                variant="title"
              />
              <TextField
                onChange={(value: string) =>
                  handleCheckboxChange(index, "confirmationPrompt", value)
                }
                placeholder="Optional confirmation prompt"
                testID={`consent-form-checkbox-${index}-prompt-input`}
                title="Confirmation Prompt (optional)"
                value={checkbox.confirmationPrompt ?? ""}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* AI Generate Modal */}
      {hasAiSupport && (
        <Modal
          onDismiss={() => setIsGenerateModalVisible(false)}
          primaryButtonOnClick={handleGenerate}
          primaryButtonText={isGenerating ? "Generating..." : "Generate"}
          secondaryButtonOnClick={() => setIsGenerateModalVisible(false)}
          secondaryButtonText="Cancel"
          size="md"
          title="Generate Content with AI"
          visible={isGenerateModalVisible}
        >
          <Box gap={3}>
            <SelectField
              onChange={setGenerateType}
              options={TYPE_OPTIONS}
              requireValue
              title="Form Type"
              value={generateType}
            />
            <Text color="secondaryDark" size="sm">
              Locale: {getLocaleLabel(activeLocale)}
            </Text>
            <TextField
              multiline
              onChange={setGenerateDescription}
              placeholder="Describe the consent form you need..."
              rows={4}
              testID="consent-form-generate-description-input"
              title="Description"
              value={generateDescription}
            />
          </Box>
        </Modal>
      )}
    </Page>
  );
};
