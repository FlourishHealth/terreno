const activeExecutions = new Map<string, AbortController>();

export const beginActiveJobExecution = (jobId: string, parentSignal: AbortSignal): AbortSignal => {
  const controller = new AbortController();
  activeExecutions.set(jobId, controller);

  if (parentSignal.aborted) {
    controller.abort();
  } else {
    parentSignal.addEventListener("abort", () => controller.abort(), {once: true});
  }

  return controller.signal;
};

export const endActiveJobExecution = (jobId: string): void => {
  activeExecutions.delete(jobId);
};

export const abortActiveJobExecution = (jobId: string): boolean => {
  const controller = activeExecutions.get(jobId);
  if (!controller) {
    return false;
  }

  controller.abort();
  return true;
};
