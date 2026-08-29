import {
  Accordion,
  Box,
  Button,
  Card,
  Heading,
  Link,
  MarkdownView,
  Page,
  Spinner,
  Text,
  useToast,
} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import {DateTime} from "luxon";
import React, {useCallback, useMemo} from "react";
import {AdminRefField} from "../AdminRefField";
import type {AdminApi} from "../types";
import {CommsStatusBadge} from "./CommsStatusBadge";
import {type CommsMessageRow, useCommsDashboardApi} from "./useCommsDashboardApi";

export interface CommsMessageDetailProps {
  api: AdminApi;
  messageId: string;
  routeBase?: string;
}

const toJsonMarkdown = (value: unknown): string => {
  return `\`\`\`json\n${JSON.stringify(value ?? null, null, 2)}\n\`\`\``;
};

const formatTimestamp = (value?: string): string => {
  if (!value) {
    return "—";
  }
  const parsed = DateTime.fromISO(value);
  if (!parsed.isValid) {
    return value;
  }
  return parsed.toUTC().toISO() ?? value;
};

const consoleUrlFromMetadata = (
  metadata: Record<string, unknown> | undefined
): string | undefined => {
  const url = metadata?.consoleUrl;
  return typeof url === "string" && url.length > 0 ? url : undefined;
};

export const CommsMessageDetail: React.FC<CommsMessageDetailProps> = ({
  api,
  messageId,
  routeBase = "/admin",
}) => {
  const toast = useToast();
  const {useDetailQuery, useRetryMutation} = useCommsDashboardApi(api);
  const {data, error, isLoading} = useDetailQuery(messageId);
  const [retryMessage, retryState] = useRetryMutation();
  const message = data?.data;

  const openMessage = useCallback(
    (id: string): void => {
      router.push(`${routeBase}/comms/${id}` as Href);
    },
    [routeBase]
  );

  const handleRetry = useCallback(async (): Promise<void> => {
    try {
      const result = await retryMessage(messageId).unwrap();
      openMessage(result.data._id);
    } catch (retryError: unknown) {
      toast.catch(retryError, "Retry failed");
    }
  }, [messageId, openMessage, retryMessage, toast]);

  const noopChange = useCallback((_value: string): void => undefined, []);

  const consoleUrl = useMemo(() => consoleUrlFromMetadata(message?.metadata), [message?.metadata]);

  return (
    <Page color="transparent" maxWidth="100%" padding={0} scroll title="Comms message">
      <Box gap={4} padding={4} testID="comms-message-detail">
        {isLoading ? (
          <Box alignItems="center" padding={6} testID="comms-detail-loading">
            <Spinner />
          </Box>
        ) : null}
        {error ? (
          <Text color="error" testID="comms-detail-error">
            Failed to load delivery log.
          </Text>
        ) : null}
        {!isLoading && !error && !message ? (
          <Text testID="comms-detail-empty">Message not found.</Text>
        ) : null}
        {message ? (
          <MessageBody
            api={api}
            consoleUrl={consoleUrl}
            handleRetry={handleRetry}
            message={message}
            noopChange={noopChange}
            openMessage={openMessage}
            retryLoading={retryState.isLoading}
            routeBase={routeBase}
          />
        ) : null}
      </Box>
    </Page>
  );
};

interface MessageBodyProps {
  api: AdminApi;
  consoleUrl?: string;
  handleRetry: () => Promise<void>;
  message: CommsMessageRow;
  noopChange: (value: string) => void;
  openMessage: (id: string) => void;
  retryLoading: boolean;
  routeBase: string;
}

const MessageBody: React.FC<MessageBodyProps> = ({
  api,
  consoleUrl,
  handleRetry,
  message,
  noopChange,
  openMessage,
  retryLoading,
  routeBase,
}) => {
  return (
    <>
      <Box direction="row" gap={3} justifyContent="between" wrap>
        <Box gap={2}>
          <Box alignItems="center" direction="row" gap={2}>
            <Heading size="md">Delivery log</Heading>
            <CommsStatusBadge status={message.status} testID="comms-detail-status" />
          </Box>
          <Text testID="comms-detail-channel">{`${message.channel} · ${message.provider}`}</Text>
          <Text testID="comms-detail-to">{`To ${message.to}`}</Text>
          <Text color="secondaryDark" size="sm">
            {`Created ${formatTimestamp(message.created)}`}
          </Text>
        </Box>
        <Button
          disabled={!message.retryable}
          loading={retryLoading}
          onClick={handleRetry}
          testID="comms-detail-retry"
          text="Retry"
          tooltipText={message.retryable ? "Retry this message" : message.retryDisabledReason}
          variant="primary"
          withConfirmation={message.retryable === true}
        />
      </Box>
      {message.userId ? (
        <Card padding={3}>
          <AdminRefField
            api={api}
            onChange={noopChange}
            readOnly
            refModelName="User"
            routeBase={routeBase}
            routePath="/users"
            testID="comms-detail-user"
            title="User"
            value={message.userId}
          />
        </Card>
      ) : null}
      <Box direction="row" gap={3} wrap>
        {message.retriedFromId ? (
          <Link
            onClick={() => openMessage(message.retriedFromId ?? "")}
            testID="comms-detail-retried-from"
            text="Original message"
          />
        ) : null}
        {message.retriedById ? (
          <Link
            onClick={() => openMessage(message.retriedById ?? "")}
            testID="comms-detail-retried-by"
            text="Retry row"
          />
        ) : null}
      </Box>
      <Card padding={3}>
        <Heading size="sm">Attempts</Heading>
        {(message.attempts ?? []).length === 0 ? (
          <Text color="secondaryDark">No attempts recorded.</Text>
        ) : (
          (message.attempts ?? []).map((attempt, index) => (
            <Box
              gap={1}
              key={`${attempt.at ?? "attempt"}-${index}`}
              padding={2}
              testID={`comms-attempt-${index}`}
            >
              <Text bold size="sm">
                {formatTimestamp(attempt.at)}
              </Text>
              <Text size="sm">{attempt.provider ?? message.provider}</Text>
              {attempt.providerMessageId && consoleUrl ? (
                <Link
                  href={consoleUrl}
                  testID={`comms-attempt-${index}-console`}
                  text={attempt.providerMessageId}
                />
              ) : (
                <Text size="sm">{attempt.providerMessageId ?? ""}</Text>
              )}
              {attempt.errorCode || attempt.error ? (
                <Text color="error" size="sm">
                  {[attempt.errorCode, attempt.error].filter(Boolean).join(" — ")}
                </Text>
              ) : null}
            </Box>
          ))
        )}
      </Card>
      <Accordion isCollapsed testID="comms-detail-payload" title="Retained payload">
        <MarkdownView>{toJsonMarkdown(message.payload)}</MarkdownView>
      </Accordion>
      <Accordion isCollapsed testID="comms-detail-metadata" title="Provider metadata">
        <MarkdownView>{toJsonMarkdown(message.metadata)}</MarkdownView>
      </Accordion>
    </>
  );
};
