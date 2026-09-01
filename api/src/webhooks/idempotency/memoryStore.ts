export type WebhookClaimResult = "claimed" | "duplicate";

export interface WebhookClaimArgs {
  eventId: string;
  source: string;
}

export interface WebhookIdempotencyStore {
  claim: (args: WebhookClaimArgs) => Promise<WebhookClaimResult>;
  release: (args: WebhookClaimArgs) => Promise<void>;
}

const claimKey = ({source, eventId}: WebhookClaimArgs): string => {
  return `${source}\0${eventId}`;
};

export const createMemoryIdempotencyStore = (): WebhookIdempotencyStore => {
  const claimed = new Set<string>();

  const claim = async (args: WebhookClaimArgs): Promise<WebhookClaimResult> => {
    const key = claimKey(args);
    if (claimed.has(key)) {
      return "duplicate";
    }
    claimed.add(key);
    return "claimed";
  };

  const release = async (args: WebhookClaimArgs): Promise<void> => {
    claimed.delete(claimKey(args));
  };

  return {claim, release};
};
