import type {Api} from "@reduxjs/toolkit/query/react";
import {Box, Button, Heading, Icon, Modal, Spinner, Text} from "@terreno/ui";
import React, {useCallback, useEffect, useRef, useState} from "react";
import type {BackgroundTask} from "./types";
import {useAdminScripts} from "./useAdminScripts";

interface AdminScriptRunModalProps {
  baseUrl: string;
  api: Api<any, any, any, any>;
  scriptName: string | null;
  visible: boolean;
  onDismiss: () => void;
}

const POLL_INTERVAL_MS = 2000;

const isTerminalStatus = (status?: string): boolean =>
  status === "completed" || status === "failed" || status === "cancelled";

export const AdminScriptRunModal: React.FC<AdminScriptRunModalProps> = ({
  baseUrl,
  api,
  scriptName,
  visible,
  onDismiss,
}) => {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"running" | "done">("running");
  const [startError, setStartError] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  const {useRunScriptMutation, useGetScriptTaskQuery, useCancelScriptTaskMutation} =
    useAdminScripts(api, baseUrl);

  const [runScript] = useRunScriptMutation();
  const [cancelTask, {isLoading: isCancelling}] = useCancelScriptTaskMutation();

  const shouldPoll = phase === "running" && taskId !== null;
  const {data: taskData} = useGetScriptTaskQuery(taskId ?? "", {
    pollingInterval: shouldPoll ? POLL_INTERVAL_MS : 0,
    skip: !taskId,
  });

  const task: BackgroundTask | undefined = taskData?.task;

  // Auto-start wet run when modal opens
  useEffect(() => {
    if (!visible || !scriptName || hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;
    setTaskId(null);
    setPhase("running");
    setStartError(null);

    void (async () => {
      try {
        const result = await runScript({name: scriptName, wetRun: true}).unwrap();
        setTaskId(result.taskId);
      } catch (err: unknown) {
        const errData = (err as {data?: {title?: string; detail?: string}})?.data;
        const message = errData?.detail ?? errData?.title ?? "Failed to start script";
        setStartError(message);
        setPhase("done");
        hasStartedRef.current = false;
      }
    })();
  }, [visible, scriptName, runScript]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      hasStartedRef.current = false;
    }
  }, [visible]);

  // Transition to done when task reaches terminal status
  useEffect(() => {
    if (task && isTerminalStatus(task.status)) {
      setPhase("done");
    }
  }, [task?.status]);

  const handleCancel = useCallback(async () => {
    if (!taskId) {
      return;
    }
    try {
      await cancelTask(taskId).unwrap();
    } catch {
      // Cancellation failed, task may already be done
    }
  }, [taskId, cancelTask]);

  const renderRunning = (): React.ReactElement => (
    <Box alignItems="center" gap={4} paddingY={4}>
      <Heading align="center" size="md">
        {scriptName}
      </Heading>
      <Spinner size="md" />
      {task?.progress?.message && <Text align="center">{task.progress.message}</Text>}
      {task?.progress?.stage && (
        <Text align="center" color="secondaryDark" size="sm">
          {task.progress.stage}
        </Text>
      )}
      {task?.progress?.percentage !== undefined && task.progress.percentage > 0 && (
        <Text align="center" color="secondaryDark" size="sm">
          {task.progress.percentage}%
        </Text>
      )}
      <Button
        disabled={isCancelling}
        loading={isCancelling}
        onClick={handleCancel}
        testID="admin-script-cancel-button"
        text="Cancel"
        variant="destructive"
      />
    </Box>
  );

  const renderDone = (): React.ReactElement => {
    const status = task?.status ?? "failed";
    const iconName =
      status === "completed"
        ? "circle-check"
        : status === "cancelled"
          ? "circle-exclamation"
          : "circle-xmark";
    const iconColor =
      status === "completed" ? "success" : status === "cancelled" ? "warning" : "error";
    const statusLabel =
      status === "completed" ? "Completed" : status === "cancelled" ? "Cancelled" : "Failed";

    return (
      <Box gap={4} paddingY={4}>
        <Heading align="center" size="md">
          {scriptName}
        </Heading>
        <Box alignItems="center" gap={2}>
          <Icon color={iconColor} iconName={iconName} size="md" />
          <Text align="center" bold>
            {statusLabel}
          </Text>
        </Box>

        {(task?.error ?? startError) && (
          <Box color="error" padding={3} rounding="md">
            <Text color="inverted" size="sm">
              {task?.error ?? startError}
            </Text>
          </Box>
        )}

        {task?.result && task.result.length > 0 && (
          <Box gap={1} maxHeight={300} overflow="scrollY" padding={2}>
            <Text bold size="sm">
              Results ({task.result.length}):
            </Text>
            {task.result.map((line, i) => (
              <Text color="secondaryDark" key={`${i}-${line.slice(0, 20)}`} size="sm">
                {line}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const isComplete = phase === "done";

  return (
    <Modal
      onDismiss={onDismiss}
      persistOnBackgroundClick={!isComplete}
      primaryButtonOnClick={onDismiss}
      primaryButtonText={isComplete ? "Close" : undefined}
      visible={visible}
    >
      <Box minHeight={200} padding={2}>
        {phase === "running" && renderRunning()}
        {phase === "done" && renderDone()}
      </Box>
    </Modal>
  );
};
