import {
  Box,
  Button,
  Card,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  DateTimeField,
  IconButton,
  Modal,
  Page,
  SelectField,
  Spinner,
  Text,
  TextField,
  useToast,
} from "@terreno/ui";
import type {Href} from "expo-router";
import {router} from "expo-router";
import {DateTime} from "luxon";
import React, {useCallback, useMemo, useState} from "react";
import type {AdminApi} from "../types";
import {CommsStatCard} from "./CommsStatCard";
import {CommsStatusBadge} from "./CommsStatusBadge";
import type {CommsDashboardFilters} from "./commsDashboardParams";
import {summarizeSkippedReasons} from "./commsRetrySummary";
import {
  type CommsMessageRow,
  type CommsStatsResponse,
  commsMessageId,
  unwrapCommsMessage,
  useCommsDashboardApi,
} from "./useCommsDashboardApi";

const LIST_LIMIT = 20;
const RETRY_MANY_CAP = 100;
const FAILURE_RATE_ALERT = 0.05;
const ALL_OPTION = {label: "All", value: ""};

const CHANNEL_OPTIONS = [
  ALL_OPTION,
  {label: "Mail", value: "mail"},
  {label: "SMS", value: "sms"},
  {label: "Push", value: "push"},
  {label: "Verification", value: "verification"},
];

const STATUS_OPTIONS = [
  ALL_OPTION,
  {label: "Sent", value: "sent"},
  {label: "Delivered", value: "delivered"},
  {label: "Failed", value: "failed"},
  {label: "Bounced", value: "bounced"},
  {label: "Cancelled", value: "cancelled"},
];

const ERROR_CLASS_OPTIONS = [
  ALL_OPTION,
  {label: "Transient", value: "transient"},
  {label: "Permanent", value: "permanent"},
  {label: "Config", value: "config"},
];

const COLUMNS: DataTableColumn[] = [
  {columnType: "date", title: "Created", width: 160},
  {columnType: "text", title: "Channel", width: 100},
  {columnType: "text", title: "Provider", width: 120},
  {columnType: "text", title: "To", width: 120},
  {columnType: "text", title: "Subject", width: 180},
  {columnType: "commsStatus", title: "Status", width: 110},
  {columnType: "text", title: "Error", width: 100},
  {columnType: "number", title: "Attempts", width: 90},
  {columnType: "commsActions", title: "", width: 88},
];

export interface CommsDashboardScreenProps {
  api: AdminApi;
  filters: CommsDashboardFilters;
  onFiltersChange: (next: CommsDashboardFilters) => void;
  routeBase?: string;
}

const percent = (rate: number): string => `${Math.round(rate * 1000) / 10}%`;

const StatsCards: React.FC<{stats?: CommsStatsResponse}> = ({stats}) => {
  const totals = stats?.totals;
  const providers = stats?.byProvider ?? [];
  const failed = totals?.failed ?? 0;
  const bounced = totals?.bounced ?? 0;
  const failureRate = totals?.failureRate ?? 0;
  const highFailure = failureRate > FAILURE_RATE_ALERT;
  return (
    <Box gap={3} testID="comms-dashboard-stats">
      <Box alignItems="stretch" direction="row" gap={3} wrap>
        <CommsStatCard label="Sent" testID="comms-stat-sent" value={String(totals?.sent ?? 0)} />
        <CommsStatCard
          label="Delivered"
          testID="comms-stat-delivered"
          value={String(totals?.delivered ?? 0)}
        />
        <CommsStatCard
          label="Failed"
          testID="comms-stat-failed"
          tone={failed > 0 ? "alert" : "neutral"}
          value={String(failed)}
        />
        <CommsStatCard
          label="Bounced"
          testID="comms-stat-bounced"
          tone={bounced > 0 ? "alert" : "neutral"}
          value={String(bounced)}
        />
        <CommsStatCard
          caption={`${failed + bounced} of ${totals?.total ?? 0} messages`}
          label="Failure rate"
          testID="comms-stat-failure-rate"
          tone={highFailure ? "alert" : "neutral"}
          value={percent(failureRate)}
        />
      </Box>
      {providers.length > 0 ? (
        <Box gap={2}>
          <Text color="secondaryDark" size="sm">
            Failure rate by provider
          </Text>
          <Box alignItems="stretch" direction="row" gap={3} wrap>
            {providers.map((row) => (
              <CommsStatCard
                caption={`${row.failed + row.bounced} of ${row.total} messages`}
                key={row.provider}
                label={row.provider}
                testID={`comms-stat-provider-${row.provider}`}
                tone={row.failureRate > FAILURE_RATE_ALERT ? "alert" : "neutral"}
                value={percent(row.failureRate)}
              />
            ))}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

export const CommsDashboardScreen: React.FC<CommsDashboardScreenProps> = ({
  api,
  filters,
  onFiltersChange,
  routeBase = "/admin",
}) => {
  const toast = useToast();
  const [confirmRetryMany, setConfirmRetryMany] = useState(false);
  const {useListQuery, useRetryManyMutation, useRetryMutation, useStatsQuery} =
    useCommsDashboardApi(api);
  const page = filters.page ?? 1;
  const listParams = useMemo(
    () => ({
      channel: filters.channel,
      endDate: filters.endDate,
      errorClass: filters.errorClass,
      limit: LIST_LIMIT,
      page,
      provider: filters.provider,
      q: filters.q,
      startDate: filters.startDate,
      status: filters.status,
    }),
    [filters, page]
  );
  const {data, error, isLoading} = useListQuery(listParams);
  const {data: stats} = useStatsQuery({
    channel: filters.channel,
    endDate: filters.endDate,
    errorClass: filters.errorClass,
    provider: filters.provider,
    q: filters.q,
    startDate: filters.startDate,
    status: filters.status,
  });
  const [retryMessage] = useRetryMutation();
  const [retryMany, retryManyState] = useRetryManyMutation();
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const retryableCount = Math.min(
    RETRY_MANY_CAP,
    rows.filter((row) => row.retryable).length + (data?.more ? RETRY_MANY_CAP : 0)
  );
  const confirmationCount = Math.min(RETRY_MANY_CAP, total);

  const setFilter = useCallback(
    (key: keyof CommsDashboardFilters, value: string): void => {
      onFiltersChange({
        ...filters,
        page: 1,
        [key]: value || undefined,
      });
    },
    [filters, onFiltersChange]
  );

  const openMessage = useCallback(
    (id: string): void => {
      router.push(`${routeBase}/comms/${id}` as Href);
    },
    [routeBase]
  );

  const handleRetry = useCallback(
    async (id: string): Promise<void> => {
      try {
        const result = await retryMessage(id).unwrap();
        const created = unwrapCommsMessage(result);
        if (!created) {
          throw new Error("Retry did not return a message");
        }
        openMessage(commsMessageId(created));
      } catch (retryError: unknown) {
        toast.catch(retryError, "Retry failed");
      }
    },
    [openMessage, retryMessage, toast]
  );

  const handleRetryMany = useCallback(async (): Promise<void> => {
    try {
      const result = await retryMany({
        channel: filters.channel,
        endDate: filters.endDate,
        errorClass: filters.errorClass,
        limit: RETRY_MANY_CAP,
        provider: filters.provider,
        q: filters.q,
        startDate: filters.startDate,
        status: filters.status,
      }).unwrap();
      setConfirmRetryMany(false);
      toast.success(
        `Retried ${result.retried.length}. Skipped ${result.skipped.length}: ${summarizeSkippedReasons(result.skipped)}.`
      );
    } catch (retryError: unknown) {
      toast.catch(retryError, "Bulk retry failed");
    }
  }, [filters, retryMany, toast]);

  const tableData = useMemo((): DataTableCellData[][] => {
    return rows.map((row: CommsMessageRow) => [
      {value: row.created ? DateTime.fromISO(row.created).toUTC().toISO() : ""},
      {value: row.channel},
      {value: row.provider},
      {value: row.to},
      {value: row.subject ?? ""},
      {value: row.status},
      {value: row.errorCode ?? ""},
      {value: row.attemptCount ?? 0},
      {
        value: {
          onOpen: () => openMessage(commsMessageId(row)),
          onRetry: row.retryable ? () => handleRetry(commsMessageId(row)) : undefined,
          retryable: row.retryable === true,
          retryDisabledReason: row.retryDisabledReason,
        },
      },
    ]);
  }, [handleRetry, openMessage, rows]);

  const customColumnComponentMap = useMemo(
    () => ({
      commsActions: ({cellData}: {cellData: DataTableCellData}) => {
        const value = cellData.value as {
          onOpen: () => void;
          onRetry?: () => void;
          retryDisabledReason?: string;
          retryable: boolean;
        };
        return (
          <Box direction="row" gap={1}>
            <IconButton
              accessibilityLabel="Open message"
              iconName="eye"
              onClick={value.onOpen}
              testID="comms-row-open"
              variant="muted"
            />
            <IconButton
              accessibilityLabel={
                value.retryable ? "Retry message" : (value.retryDisabledReason ?? "Retry")
              }
              disabled={!value.retryable}
              iconName="rotate"
              onClick={value.onRetry ?? ((): void => undefined)}
              testID="comms-row-retry"
              tooltipText={value.retryable ? "Retry" : value.retryDisabledReason}
              variant="muted"
              withConfirmation={value.retryable}
            />
          </Box>
        );
      },
      commsStatus: ({cellData}: {cellData: DataTableCellData}) => (
        <CommsStatusBadge status={String(cellData.value ?? "")} />
      ),
    }),
    []
  );

  return (
    <Page color="transparent" maxWidth="100%" padding={0} scroll title="Comms">
      <Box gap={4} padding={4} testID="comms-dashboard">
        <StatsCards stats={stats} />
        <Card padding={3}>
          <Box direction="row" gap={3} wrap>
            <Box width={160}>
              <SelectField
                onChange={(value) => setFilter("channel", value)}
                options={CHANNEL_OPTIONS}
                testID="comms-filter-channel"
                title="Channel"
                value={filters.channel ?? ""}
              />
            </Box>
            <Box width={160}>
              <TextField
                onChange={(value) => setFilter("provider", value)}
                testID="comms-filter-provider"
                title="Provider"
                value={filters.provider ?? ""}
              />
            </Box>
            <Box width={160}>
              <SelectField
                onChange={(value) => setFilter("status", value)}
                options={STATUS_OPTIONS}
                testID="comms-filter-status"
                title="Status"
                value={filters.status ?? ""}
              />
            </Box>
            <Box width={160}>
              <SelectField
                onChange={(value) => setFilter("errorClass", value)}
                options={ERROR_CLASS_OPTIONS}
                testID="comms-filter-error-class"
                title="Error class"
                value={filters.errorClass ?? ""}
              />
            </Box>
            <Box width={200}>
              <TextField
                iconName="magnifying-glass"
                onChange={(value) => setFilter("q", value)}
                testID="comms-filter-q"
                title="Search"
                value={filters.q ?? ""}
              />
            </Box>
            <Box width={180}>
              <DateTimeField
                onChange={(value) => setFilter("startDate", value)}
                testID="comms-filter-start"
                title="Start"
                type="datetime"
                value={filters.startDate ?? ""}
              />
            </Box>
            <Box width={180}>
              <DateTimeField
                onChange={(value) => setFilter("endDate", value)}
                testID="comms-filter-end"
                title="End"
                type="datetime"
                value={filters.endDate ?? ""}
              />
            </Box>
            <Box justifyContent="end">
              <Button
                disabled={total === 0}
                onClick={() => setConfirmRetryMany(true)}
                testID="comms-retry-many"
                text="Retry matching"
                variant="secondary"
              />
            </Box>
          </Box>
        </Card>
        {isLoading ? (
          <Box alignItems="center" padding={6} testID="comms-dashboard-loading">
            <Spinner />
          </Box>
        ) : null}
        {error ? (
          <Text color="error" testID="comms-dashboard-error">
            Failed to load delivery logs.
          </Text>
        ) : null}
        {!isLoading && !error && rows.length === 0 ? (
          <Text testID="comms-dashboard-empty">No delivery logs match these filters.</Text>
        ) : null}
        {!isLoading && !error && rows.length > 0 ? (
          <DataTable
            columns={COLUMNS}
            customColumnComponentMap={customColumnComponentMap}
            data={tableData}
            page={page}
            setPage={(nextPage) => onFiltersChange({...filters, page: nextPage})}
            testID="comms-dashboard-table"
            totalPages={Math.max(1, Math.ceil(total / LIST_LIMIT))}
          />
        ) : null}
      </Box>
      <Modal
        onDismiss={() => setConfirmRetryMany(false)}
        primaryButtonOnClick={handleRetryMany}
        primaryButtonText="Retry"
        secondaryButtonOnClick={() => setConfirmRetryMany(false)}
        secondaryButtonText="Cancel"
        testID="comms-retry-many-modal"
        title="Retry matching messages"
        visible={confirmRetryMany}
      >
        <Box gap={2}>
          <Text testID="comms-retry-many-count">
            {`Retry ${confirmationCount} matching message${confirmationCount === 1 ? "" : "s"} (cap ${RETRY_MANY_CAP})?`}
          </Text>
          {retryManyState.isLoading ? <Spinner /> : null}
          <Text color="secondaryDark" size="sm">
            {`Current page has ${retryableCount} retryable row${retryableCount === 1 ? "" : "s"}.`}
          </Text>
        </Box>
      </Modal>
    </Page>
  );
};
