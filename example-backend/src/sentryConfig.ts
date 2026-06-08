export interface SentryInitializationDecision {
  shouldInitialize: boolean;
  shouldWarnMissingDsn: boolean;
}

export interface SentryInitializationDecisionInput {
  nodeEnv?: string;
  sentryDsn?: string;
}

export const getSentryInitializationDecision = ({
  nodeEnv,
  sentryDsn,
}: SentryInitializationDecisionInput): SentryInitializationDecision => {
  const hasSentryDsn = Boolean(sentryDsn);
  return {
    shouldInitialize: hasSentryDsn,
    shouldWarnMissingDsn: nodeEnv === "production" && !hasSentryDsn,
  };
};
