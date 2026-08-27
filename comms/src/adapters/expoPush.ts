import {createRequire} from "node:module";
import {logger} from "@terreno/api";

import type {CommsErrorClass, DeliveryEvent, PushMessage, PushProvider, SendResult} from "../types";

const nodeRequire = createRequire(__filename);
const DEFAULT_RECEIPT_POLL_DELAY_MS = 15 * 60 * 1000;

export interface ExpoPushMessage {
  badge?: number;
  body: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  title: string;
  to: string;
}

export interface ExpoPushTicket {
  details?: {error?: string};
  id?: string;
  message?: string;
  status: "error" | "ok";
}

export interface ExpoPushReceipt {
  details?: {error?: string};
  message?: string;
  status: "error" | "ok";
}

export interface ExpoPushClient {
  chunkPushNotificationReceiptIds: (receiptIds: string[]) => string[][];
  chunkPushNotifications: (messages: ExpoPushMessage[]) => ExpoPushMessage[][];
  getPushNotificationReceiptsAsync: (
    receiptIds: string[]
  ) => Promise<Record<string, ExpoPushReceipt>>;
  sendPushNotificationsAsync: (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;
}

interface ExpoSdkModule {
  Expo: {
    isExpoPushToken: (token: string) => boolean;
    new (options?: {accessToken?: string}): ExpoPushClient;
  };
}

export interface ExpoPushProviderOptions {
  accessToken?: string;
  /** Injected client for tests. Production wiring loads `expo-server-sdk`. */
  client?: ExpoPushClient;
  isExpoPushToken?: (token: string) => boolean;
  onDeadToken?: (token: string) => Promise<void>;
  onDeliveryEvent?: (event: DeliveryEvent) => Promise<void>;
  receiptPollDelayMs?: number;
  scheduleReceiptPoll?: (delayMs: number, run: () => Promise<void>) => void;
}

const resolveAccessToken = (options?: ExpoPushProviderOptions): string | undefined =>
  options?.accessToken ?? process.env.EXPO_ACCESS_TOKEN;

const loadExpoSdk = (): ExpoSdkModule => {
  try {
    // Optional peer — keep `expo-server-sdk` out of core dependencies.
    return nodeRequire("expo-server-sdk") as ExpoSdkModule;
  } catch {
    throw new Error(
      "ExpoPushProvider requires optional peer dependency expo-server-sdk. " +
        "Install it with: bun add expo-server-sdk"
    );
  }
};

const defaultIsExpoPushToken = (token: string): boolean =>
  (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) &&
  token.endsWith("]");

const classifyExpoError = (
  code: string | undefined
): {errorClass: CommsErrorClass; errorCode: string} => {
  if (code === "InvalidCredentials") {
    return {errorClass: "config", errorCode: code};
  }
  if (code === "DeviceNotRegistered" || code === "MessageTooBig") {
    return {errorClass: "permanent", errorCode: code};
  }
  if (code === "MessageRateExceeded") {
    return {errorClass: "transient", errorCode: code};
  }
  return {errorClass: "transient", errorCode: code ?? "expo-unknown"};
};

const failedResult = ({
  error,
  errorClass,
  errorCode,
}: {
  error: string;
  errorClass: CommsErrorClass;
  errorCode: string;
}): SendResult => {
  if (errorClass === "config") {
    logger.error(`[comms:expo] ${errorCode}: ${error}`);
  }
  return {
    accepted: false,
    error,
    errorClass,
    errorCode,
    isPermanentFailure: errorClass === "permanent",
  };
};

const invalidTokenResult = (): SendResult =>
  failedResult({
    error: "Not an Expo push token",
    errorClass: "permanent",
    errorCode: "expo-invalid-token",
  });

const ticketToResult = (ticket: ExpoPushTicket | undefined): SendResult => {
  if (!ticket) {
    return failedResult({
      error: "Expo returned no ticket for this token",
      errorClass: "transient",
      errorCode: "expo-missing-ticket",
    });
  }
  if (ticket.status === "ok") {
    return {accepted: true, providerMessageId: ticket.id};
  }
  const {errorClass, errorCode} = classifyExpoError(ticket.details?.error);
  return failedResult({
    error: ticket.message ?? errorCode,
    errorClass,
    errorCode,
  });
};

const defaultScheduleReceiptPoll = (delayMs: number, run: () => Promise<void>): void => {
  setTimeout(() => {
    void run();
  }, delayMs);
};

export class ExpoPushProvider implements PushProvider {
  readonly id = "expo";
  private readonly client: ExpoPushClient;
  private readonly isExpoPushToken: (token: string) => boolean;
  private readonly onDeadToken?: (token: string) => Promise<void>;
  private readonly onDeliveryEvent?: (event: DeliveryEvent) => Promise<void>;
  private readonly receiptPollDelayMs: number;
  private readonly scheduleReceiptPoll: (delayMs: number, run: () => Promise<void>) => void;
  private pendingReceipts = new Map<string, string>();

  constructor(options?: ExpoPushProviderOptions) {
    this.onDeadToken = options?.onDeadToken;
    this.onDeliveryEvent = options?.onDeliveryEvent;
    this.receiptPollDelayMs = options?.receiptPollDelayMs ?? DEFAULT_RECEIPT_POLL_DELAY_MS;
    this.scheduleReceiptPoll = options?.scheduleReceiptPoll ?? defaultScheduleReceiptPoll;

    if (options?.client) {
      this.client = options.client;
      this.isExpoPushToken = options.isExpoPushToken ?? defaultIsExpoPushToken;
      return;
    }

    const ExpoSdk = loadExpoSdk();
    const accessToken = resolveAccessToken(options);
    this.client = new ExpoSdk.Expo(accessToken ? {accessToken} : {});
    this.isExpoPushToken = options?.isExpoPushToken ?? ExpoSdk.Expo.isExpoPushToken;
  }

  async sendPush(message: PushMessage): Promise<SendResult[]> {
    const results: SendResult[] = message.tokens.map((token) =>
      this.isExpoPushToken(token) ? {accepted: false, errorCode: "pending"} : invalidTokenResult()
    );
    const validIndexes: number[] = [];
    const expoMessages: ExpoPushMessage[] = [];
    message.tokens.forEach((token, index) => {
      if (!this.isExpoPushToken(token)) {
        return;
      }
      validIndexes.push(index);
      expoMessages.push({
        badge: message.badge,
        body: message.body,
        data: message.data,
        sound: message.sound,
        title: message.title,
        to: token,
      });
    });

    if (expoMessages.length === 0) {
      return results.map((result) =>
        result.errorCode === "pending" ? invalidTokenResult() : result
      );
    }

    const chunks = this.client.chunkPushNotifications(expoMessages);
    let cursor = 0;
    const newReceipts: string[] = [];
    for (const chunk of chunks) {
      let tickets: ExpoPushTicket[];
      try {
        tickets = await this.client.sendPushNotificationsAsync(chunk);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Expo send failed";
        for (let offset = 0; offset < chunk.length; offset += 1) {
          const tokenIndex = validIndexes[cursor + offset];
          if (tokenIndex === undefined) {
            continue;
          }
          results[tokenIndex] = failedResult({
            error: errorMessage,
            errorClass: "transient",
            errorCode: "expo-send-throw",
          });
        }
        cursor += chunk.length;
        continue;
      }

      chunk.forEach((expoMessage, offset) => {
        const tokenIndex = validIndexes[cursor + offset];
        if (tokenIndex === undefined) {
          return;
        }
        const result = ticketToResult(tickets[offset]);
        results[tokenIndex] = result;
        if (result.accepted && result.providerMessageId) {
          this.pendingReceipts.set(result.providerMessageId, String(expoMessage.to));
          newReceipts.push(result.providerMessageId);
        }
      });
      cursor += chunk.length;
    }

    if (newReceipts.length > 0) {
      this.scheduleReceiptPoll(this.receiptPollDelayMs, () => this.pollReceipts(newReceipts));
    }

    return results.map((result) =>
      result.errorCode === "pending"
        ? failedResult({
            error: "Expo returned no ticket for this token",
            errorClass: "transient",
            errorCode: "expo-missing-ticket",
          })
        : result
    );
  }

  private async pollReceipts(receiptIds: string[]): Promise<void> {
    const chunks = this.client.chunkPushNotificationReceiptIds(receiptIds);
    for (const chunk of chunks) {
      let receipts: Record<string, ExpoPushReceipt>;
      try {
        receipts = await this.client.getPushNotificationReceiptsAsync(chunk);
      } catch (error: unknown) {
        logger.warn(`[comms:expo] Receipt poll failed: ${String(error)}`);
        for (const receiptId of chunk) {
          this.pendingReceipts.delete(receiptId);
        }
        continue;
      }
      await Promise.all(
        Object.entries(receipts).map(([receiptId, receipt]) =>
          this.applyReceipt(receiptId, receipt)
        )
      );
    }
  }

  private async applyReceipt(receiptId: string, receipt: ExpoPushReceipt): Promise<void> {
    const token = this.pendingReceipts.get(receiptId);
    this.pendingReceipts.delete(receiptId);
    if (receipt.status === "ok") {
      if (this.onDeliveryEvent) {
        await this.onDeliveryEvent({
          channel: "push",
          providerMessageId: receiptId,
          raw: receipt,
          status: "delivered",
        });
      }
      return;
    }
    const {errorClass, errorCode} = classifyExpoError(receipt.details?.error);
    if (this.onDeliveryEvent) {
      await this.onDeliveryEvent({
        channel: "push",
        errorClass,
        errorCode,
        providerMessageId: receiptId,
        raw: receipt,
        status: "failed",
      });
    }
    if (token && errorClass === "permanent" && this.onDeadToken) {
      await this.onDeadToken(token);
    }
  }
}
