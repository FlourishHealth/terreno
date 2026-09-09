import {
  BooleanField,
  Box,
  Button,
  CheckBox,
  DateTimeField,
  Heading,
  MarkdownEditor,
  NumberField,
  Page,
  Spinner,
  Text,
  TextField,
  useToast,
} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {asDynamicHookApi} from "./dynamicHookApi";
import {type AdminApi, type EndpointBuilder, resolveAdminBases} from "./types";
import {useAdminApi} from "./useAdminApi";

type AnnouncementPlatform = "ios" | "android" | "web";
type AnnouncementStatus = "draft" | "published" | "archived";

interface AnnouncementPrimaryAction {
  label: string;
  url: string;
}

/** Announcement document — shape comes from the consumer's Mongoose model. */
interface AnnouncementDocument {
  _id?: string;
  title?: string;
  body?: string;
  status?: AnnouncementStatus;
  version?: number;
  priority?: number;
  requiresAcknowledgement?: boolean;
  audience?: unknown;
  publishAt?: string;
  expiresAt?: string;
  platforms?: AnnouncementPlatform[];
  primaryAction?: AnnouncementPrimaryAction;
  [key: string]: unknown;
}

interface AnnouncementEditorProps {
  /** @deprecated Use `apiBase`/`routeBase`. Kept as a backward-compatible alias. */
  baseUrl?: string;
  /** Base path where admin API requests are sent. Falls back to `baseUrl`. */
  apiBase?: string;
  /** Base path used for in-app navigation. Falls back to `baseUrl`. */
  routeBase?: string;
  api: AdminApi;
  id?: string;
  onSave?: (announcement: AnnouncementDocument | undefined) => void;
  onCancel?: () => void;
}

const ANNOUNCEMENT_ADMIN_ROUTE = "/announcements";
const ANNOUNCEMENT_ACTION_ROUTE = "/announcements";

const PLATFORM_OPTIONS: {label: string; value: AnnouncementPlatform}[] = [
  {label: "iOS", value: "ios"},
  {label: "Android", value: "android"},
  {label: "Web", value: "web"},
];

const toIsoOrEmpty = (value: unknown): string => {
  if (!value) {
    return "";
  }
  const parsed = DateTime.fromISO(String(value));
  if (!parsed.isValid) {
    return "";
  }
  return parsed.toUTC().toISO() ?? "";
};

const parseAudienceJson = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed) as unknown;
};

const enhancedApiCache = new WeakMap<AdminApi, unknown>();

const getEnhancedApi = (api: AdminApi): unknown => {
  const cached = enhancedApiCache.get(api);
  if (cached) {
    return cached;
  }
  const enhanced = api.injectEndpoints({
    endpoints: (build: EndpointBuilder) => ({
      archiveAnnouncement: build.mutation({
        query: (announcementId: string) => ({
          method: "POST",
          url: `${ANNOUNCEMENT_ACTION_ROUTE}/${announcementId}/archive`,
        }),
      }),
      publishAnnouncement: build.mutation({
        query: (announcementId: string) => ({
          method: "POST",
          url: `${ANNOUNCEMENT_ACTION_ROUTE}/${announcementId}/publish`,
        }),
      }),
    }),
    overrideExisting: false,
  });
  enhancedApiCache.set(api, enhanced);
  return enhanced;
};

export const AnnouncementEditor: React.FC<AnnouncementEditorProps> = ({
  baseUrl,
  apiBase,
  routeBase,
  api,
  id,
  onSave,
  onCancel,
}) => {
  const {apiBase: resolvedApiBase} = resolveAdminBases({apiBase, baseUrl, routeBase});
  const isEditMode = Boolean(id);
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<AnnouncementStatus>("draft");
  const [version, setVersion] = useState(1);
  const [priority, setPriority] = useState("0");
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [audienceJson, setAudienceJson] = useState("{}");
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [platforms, setPlatforms] = useState<AnnouncementPlatform[]>(["ios", "android", "web"]);
  const [primaryActionLabel, setPrimaryActionLabel] = useState("");
  const [primaryActionUrl, setPrimaryActionUrl] = useState("");

  const routePath = `${resolvedApiBase}${ANNOUNCEMENT_ADMIN_ROUTE}`;

  const {useReadQuery, useCreateMutation, useUpdateMutation} = useAdminApi(
    api,
    routePath,
    "Announcement"
  );

  const enhanced = asDynamicHookApi(getEnhancedApi(api));
  const [publishAnnouncement, {isLoading: isPublishing}] =
    enhanced.usePublishAnnouncementMutation();
  const [archiveAnnouncement, {isLoading: isArchiving}] = enhanced.useArchiveAnnouncementMutation();

  const {data: announcementData, isLoading: isAnnouncementLoading} = useReadQuery(id ?? "", {
    skip: !isEditMode || !id,
  });

  const [createAnnouncement, {isLoading: isCreating}] = useCreateMutation();
  const [updateAnnouncement, {isLoading: isUpdating}] = useUpdateMutation();

  // Populate form state when editing an existing announcement
  useEffect(() => {
    if (!announcementData) {
      return;
    }
    setTitle(announcementData.title ?? "");
    setBody(announcementData.body ?? "");
    setStatus((announcementData.status as AnnouncementStatus | undefined) ?? "draft");
    setVersion(typeof announcementData.version === "number" ? announcementData.version : 1);
    setPriority(String(announcementData.priority ?? 0));
    setRequiresAcknowledgement(Boolean(announcementData.requiresAcknowledgement));
    setAudienceJson(
      announcementData.audience != null ? JSON.stringify(announcementData.audience, null, 2) : "{}"
    );
    setPublishAt(toIsoOrEmpty(announcementData.publishAt));
    setExpiresAt(toIsoOrEmpty(announcementData.expiresAt));
    if (Array.isArray(announcementData.platforms) && announcementData.platforms.length > 0) {
      setPlatforms(announcementData.platforms as AnnouncementPlatform[]);
    }
    const action = announcementData.primaryAction as AnnouncementPrimaryAction | undefined;
    setPrimaryActionLabel(action?.label ?? "");
    setPrimaryActionUrl(action?.url ?? "");
  }, [announcementData]);

  const handlePlatformToggle = useCallback((platform: AnnouncementPlatform) => {
    setPlatforms((prev) => {
      if (prev.includes(platform)) {
        return prev.filter((item) => item !== platform);
      }
      return [...prev, platform];
    });
  }, []);

  const buildPayload = useCallback(() => {
    let audience: unknown = {};
    try {
      audience = parseAudienceJson(audienceJson);
    } catch {
      throw new Error("Audience must be valid JSON");
    }

    const hasPrimaryLabel = Boolean(primaryActionLabel.trim());
    const hasPrimaryUrl = Boolean(primaryActionUrl.trim());
    let primaryAction: AnnouncementPrimaryAction | undefined;
    if (hasPrimaryLabel && hasPrimaryUrl) {
      primaryAction = {label: primaryActionLabel.trim(), url: primaryActionUrl.trim()};
    } else if (hasPrimaryLabel || hasPrimaryUrl) {
      throw new Error("Primary action requires both label and URL");
    }

    return {
      audience,
      body: body.trim(),
      expiresAt: expiresAt ? DateTime.fromISO(expiresAt).toUTC().toJSDate() : undefined,
      platforms: platforms.length > 0 ? platforms : ["ios", "android", "web"],
      primaryAction,
      priority: parseInt(priority, 10) || 0,
      publishAt: publishAt ? DateTime.fromISO(publishAt).toUTC().toJSDate() : undefined,
      requiresAcknowledgement,
      status,
      title: title.trim(),
    };
  }, [
    audienceJson,
    body,
    expiresAt,
    platforms,
    primaryActionLabel,
    primaryActionUrl,
    priority,
    publishAt,
    requiresAcknowledgement,
    status,
    title,
  ]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Body is required");
      return;
    }

    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid form data");
      return;
    }

    try {
      let result: AnnouncementDocument | undefined;
      if (isEditMode && id) {
        result = (await updateAnnouncement({body: payload, id}).unwrap()) as AnnouncementDocument;
      } else {
        result = (await createAnnouncement(payload).unwrap()) as AnnouncementDocument;
      }
      console.info("Announcement saved", {id: result?._id ?? id});
      onSave?.(result);
    } catch (err) {
      toast.catch(err, `Failed to ${isEditMode ? "update" : "create"} announcement`);
    }
  }, [
    body,
    buildPayload,
    createAnnouncement,
    id,
    isEditMode,
    onSave,
    title,
    toast,
    updateAnnouncement,
  ]);

  const handlePublish = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      const result = (await publishAnnouncement(id).unwrap()) as {data?: AnnouncementDocument};
      const published = result?.data;
      if (published?.status) {
        setStatus(published.status as AnnouncementStatus);
      }
      console.info("Announcement published", {id});
      toast.success("Announcement published");
    } catch (err) {
      toast.catch(err, "Failed to publish announcement");
    }
  }, [id, publishAnnouncement, toast]);

  const handleArchive = useCallback(async () => {
    if (!id) {
      return;
    }
    try {
      const result = (await archiveAnnouncement(id).unwrap()) as {data?: AnnouncementDocument};
      const archived = result?.data;
      if (archived?.status) {
        setStatus(archived.status as AnnouncementStatus);
      }
      console.info("Announcement archived", {id});
      toast.success("Announcement archived");
    } catch (err) {
      toast.catch(err, "Failed to archive announcement");
    }
  }, [archiveAnnouncement, id, toast]);

  const statusLabel = useMemo(() => {
    if (status === "published") {
      return `Published (v${version})`;
    }
    if (status === "archived") {
      return "Archived";
    }
    return "Draft";
  }, [status, version]);

  if (isEditMode && isAnnouncementLoading) {
    return (
      <Page color="transparent" maxWidth="100%" padding={0}>
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  const isSaving = isCreating || isUpdating;
  const canPublish = isEditMode && status === "draft";
  const canArchive = isEditMode && status === "published";

  return (
    <Page
      color="transparent"
      footer={
        <Box direction="row" gap={2} justifyContent="between" padding={2}>
          <Box>
            {onCancel && (
              <Button
                onClick={onCancel}
                testID="announcement-cancel-button"
                text="Cancel"
                variant="secondary"
              />
            )}
          </Box>
          <Button
            loading={isSaving}
            onClick={handleSave}
            testID="announcement-save-button"
            text={isEditMode ? "Save" : "Create"}
            variant="primary"
          />
        </Box>
      }
      maxWidth="100%"
      padding={0}
      scroll
    >
      <Box gap={4} padding={4}>
        {isEditMode && (
          <Box alignItems="center" direction="row" justifyContent="between">
            <Heading size="md">{title || "Edit Announcement"}</Heading>
            <Box alignItems="center" direction="row" gap={2}>
              <Text color="secondaryDark" size="sm">
                {statusLabel}
              </Text>
              {canArchive && (
                <Button
                  loading={isArchiving}
                  onClick={handleArchive}
                  testID="announcement-archive-button"
                  text="Archive"
                  variant="secondary"
                />
              )}
              {canPublish && (
                <Button
                  loading={isPublishing}
                  onClick={handlePublish}
                  testID="announcement-publish-button"
                  text="Publish"
                  variant="primary"
                />
              )}
            </Box>
          </Box>
        )}

        <Box gap={3}>
          <Heading size="sm">Content</Heading>
          <TextField
            onChange={setTitle}
            placeholder="Announcement title"
            testID="announcement-title-input"
            title="Title"
            value={title}
          />
          <MarkdownEditor
            onChange={setBody}
            placeholder="Markdown body (supports YouTube and Loom embeds)"
            testID="announcement-body-input"
            title="Body"
            value={body}
          />
        </Box>

        <Box gap={3}>
          <Heading size="sm">Delivery</Heading>
          <NumberField
            onChange={setPriority}
            testID="announcement-priority-input"
            title="Priority"
            type="number"
            value={priority}
          />
          <BooleanField
            onChange={setRequiresAcknowledgement}
            title="Requires acknowledgement"
            value={requiresAcknowledgement}
            variant="title"
          />
          <DateTimeField
            onChange={setPublishAt}
            testID="announcement-publish-at-input"
            title="Publish at (optional)"
            type="datetime"
            value={publishAt}
          />
          <DateTimeField
            onChange={setExpiresAt}
            testID="announcement-expires-at-input"
            title="Expires at (optional)"
            type="datetime"
            value={expiresAt}
          />
          <Box gap={2}>
            <Text size="sm">Platforms</Text>
            {PLATFORM_OPTIONS.map((option) => (
              <Box
                accessibilityHint={`Toggle ${option.label} platform`}
                accessibilityLabel={option.label}
                alignItems="center"
                direction="row"
                gap={1}
                key={option.value}
                onClick={() => handlePlatformToggle(option.value)}
                testID={`announcement-platform-${option.value}`}
              >
                <CheckBox selected={platforms.includes(option.value)} />
                <Text>{option.label}</Text>
              </Box>
            ))}
          </Box>
        </Box>

        <Box gap={3}>
          <Heading size="sm">Targeting</Heading>
          <TextField
            multiline
            onChange={setAudienceJson}
            placeholder='{"tiers": ["premium"]}'
            rows={4}
            testID="announcement-audience-input"
            title="Audience JSON"
            value={audienceJson}
          />
        </Box>

        <Box gap={3}>
          <Heading size="sm">Primary action (optional)</Heading>
          <TextField
            onChange={setPrimaryActionLabel}
            placeholder="Learn more"
            testID="announcement-primary-label-input"
            title="Button label"
            value={primaryActionLabel}
          />
          <TextField
            onChange={setPrimaryActionUrl}
            placeholder="https://example.com/docs"
            testID="announcement-primary-url-input"
            title="Button URL"
            value={primaryActionUrl}
          />
        </Box>
      </Box>
    </Page>
  );
};
