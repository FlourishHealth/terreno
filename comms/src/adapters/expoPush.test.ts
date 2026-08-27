import {describe, it} from "bun:test";
import {setupDb} from "@terreno/api/testing";
import {assert} from "chai";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import {CommsService} from "../commsService";
import {CommsMessage} from "../models/commsMessage";
import {PushToken} from "../models/pushToken";
import type {DeliveryEvent} from "../types";
import {
  type ExpoPushClient,
  type ExpoPushMessage,
  ExpoPushProvider,
  type ExpoPushReceipt,
  type ExpoPushTicket,
} from "./expoPush";

interface MockExpoClient extends ExpoPushClient {
  receiptRequests: string[][];
  sendChunks: ExpoPushMessage[][];
}

const createMockClient = ({
  chunkSize = 100,
  receipts = {},
  tickets,
}: {
  chunkSize?: number;
  receipts?: Record<string, ExpoPushReceipt>;
  tickets: ExpoPushTicket[];
}): MockExpoClient => {
  const sendChunks: ExpoPushMessage[][] = [];
  const receiptRequests: string[][] = [];
  let ticketOffset = 0;
  return {
    chunkPushNotificationReceiptIds: (ids: string[]): string[][] => {
      if (ids.length === 0) {
        return [];
      }
      const chunks: string[][] = [];
      for (let index = 0; index < ids.length; index += chunkSize) {
        chunks.push(ids.slice(index, index + chunkSize));
      }
      return chunks;
    },
    chunkPushNotifications: (messages: ExpoPushMessage[]): ExpoPushMessage[][] => {
      if (messages.length === 0) {
        return [];
      }
      const chunks: ExpoPushMessage[][] = [];
      for (let index = 0; index < messages.length; index += chunkSize) {
        chunks.push(messages.slice(index, index + chunkSize));
      }
      return chunks;
    },
    getPushNotificationReceiptsAsync: async (
      ids: string[]
    ): Promise<Record<string, ExpoPushReceipt>> => {
      receiptRequests.push([...ids]);
      const selected: Record<string, ExpoPushReceipt> = {};
      for (const id of ids) {
        const receipt = receipts[id];
        if (receipt) {
          selected[id] = receipt;
        }
      }
      return selected;
    },
    receiptRequests,
    sendChunks,
    sendPushNotificationsAsync: async (messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> => {
      sendChunks.push(messages);
      const slice = tickets.slice(ticketOffset, ticketOffset + messages.length);
      ticketOffset += messages.length;
      return slice;
    },
  };
};

const validToken = (suffix: string): string => `ExponentPushToken[${suffix}]`;

describe("ExpoPushProvider", () => {
  it("returns one SendResult per token across chunk boundaries", async (): Promise<void> => {
    const tokens = [validToken("a"), validToken("b"), validToken("c")];
    const client = createMockClient({
      chunkSize: 2,
      tickets: [
        {id: "ticket-a", status: "ok"},
        {id: "ticket-b", status: "ok"},
        {id: "ticket-c", status: "ok"},
      ],
    });
    const provider = new ExpoPushProvider({
      accessToken: "expo-test-token",
      client,
    });

    const results = await provider.sendPush({
      body: "Hello",
      title: "Ping",
      tokens,
    });

    assert.equal(results.length, 3);
    assert.deepEqual(
      results.map((result) => result.providerMessageId),
      ["ticket-a", "ticket-b", "ticket-c"]
    );
    assert.isTrue(results.every((result) => result.accepted));
    assert.equal(client.sendChunks.length, 2);
    assert.equal(client.sendChunks[0]?.length, 2);
    assert.equal(client.sendChunks[1]?.length, 1);
    assert.equal(client.sendChunks[0]?.[0]?.to, tokens[0]);
  });

  it("rejects invalid tokens before calling the SDK and logs failed CommsMessage rows", async (): Promise<void> => {
    await setupDb();
    await Promise.all([CommsMessage.deleteMany({}), PushToken.deleteMany({})]);
    const userId = new mongoose.Types.ObjectId();
    const good = validToken("good");
    const bad = "not-an-expo-token";
    await PushToken.create({
      active: true,
      lastSeenAt: DateTime.utc().toJSDate(),
      platform: "ios",
      token: good,
      userId,
    });
    await PushToken.create({
      active: true,
      lastSeenAt: DateTime.utc().toJSDate(),
      platform: "ios",
      token: bad,
      userId,
    });

    const client = createMockClient({
      tickets: [{id: "ticket-good", status: "ok"}],
    });
    const provider = new ExpoPushProvider({client});
    const service = new CommsService({push: provider, redactRecipients: false});

    const results = await service.sendPushToUser({
      body: "Hello",
      title: "Ping",
      userId,
    });

    assert.equal(client.sendChunks.length, 1);
    assert.deepEqual(
      client.sendChunks[0]?.map((message) => message.to),
      [good]
    );
    const byToken = new Map(
      (await CommsMessage.find({channel: "push"}).sort({to: 1})).map(
        (row) => [row.to, row] as const
      )
    );
    assert.equal(byToken.get(bad)?.status, "failed");
    assert.equal(byToken.get(bad)?.errorCode, "expo-invalid-token");
    assert.equal(byToken.get(good)?.status, "sent");
    assert.equal(results.filter((result) => !result.accepted).length, 1);
  });

  it("classifies DeviceNotRegistered tickets as permanent", async (): Promise<void> => {
    const client = createMockClient({
      tickets: [
        {
          details: {error: "DeviceNotRegistered"},
          message: "not registered",
          status: "error",
        },
      ],
    });
    const provider = new ExpoPushProvider({client});
    const [result] = await provider.sendPush({
      body: "Hello",
      title: "Ping",
      tokens: [validToken("dead")],
    });

    assert.isFalse(result?.accepted);
    assert.equal(result?.errorClass, "permanent");
    assert.equal(result?.errorCode, "DeviceNotRegistered");
    assert.isTrue(result?.isPermanentFailure);
  });

  it("deactivates the PushToken when sendPushToUser gets a DeviceNotRegistered ticket", async (): Promise<void> => {
    await setupDb();
    await Promise.all([CommsMessage.deleteMany({}), PushToken.deleteMany({})]);
    const userId = new mongoose.Types.ObjectId();
    const token = validToken("ticket-dead");
    await PushToken.create({
      active: true,
      lastSeenAt: DateTime.utc().toJSDate(),
      platform: "ios",
      token,
      userId,
    });
    const client = createMockClient({
      tickets: [
        {
          details: {error: "DeviceNotRegistered"},
          message: "not registered",
          status: "error",
        },
      ],
    });
    const service = new CommsService({
      push: new ExpoPushProvider({client}),
      redactRecipients: false,
    });

    const results = await service.sendPushToUser({
      body: "Hello",
      title: "Ping",
      userId,
    });

    assert.isFalse(results[0]?.accepted);
    assert.equal(results[0]?.errorClass, "permanent");
    assert.equal((await PushToken.findExactlyOne({token})).active, false);
    assert.equal((await CommsMessage.findExactlyOne({to: token})).status, "failed");
  });

  it("classifies MessageRateExceeded as transient and InvalidCredentials as config", async (): Promise<void> => {
    const rateClient = createMockClient({
      tickets: [
        {
          details: {error: "MessageRateExceeded"},
          message: "slow down",
          status: "error",
        },
      ],
    });
    const [rateLimited] = await new ExpoPushProvider({client: rateClient}).sendPush({
      body: "Hello",
      title: "Ping",
      tokens: [validToken("rate")],
    });
    assert.equal(rateLimited?.errorClass, "transient");
    assert.equal(rateLimited?.errorCode, "MessageRateExceeded");

    const configClient = createMockClient({
      tickets: [
        {
          details: {error: "InvalidCredentials"},
          message: "bad token",
          status: "error",
        },
      ],
    });
    const [configFailure] = await new ExpoPushProvider({client: configClient}).sendPush({
      body: "Hello",
      title: "Ping",
      tokens: [validToken("creds")],
    });
    assert.equal(configFailure?.errorClass, "config");
    assert.equal(configFailure?.errorCode, "InvalidCredentials");
  });

  it("maps a thrown Expo send to a transient result per token", async (): Promise<void> => {
    const client = createMockClient({tickets: []});
    client.sendPushNotificationsAsync = async (): Promise<ExpoPushTicket[]> => {
      throw new Error("network down");
    };
    const [result] = await new ExpoPushProvider({client}).sendPush({
      body: "Hello",
      title: "Ping",
      tokens: [validToken("net")],
    });
    assert.isFalse(result?.accepted);
    assert.equal(result?.errorClass, "transient");
    assert.equal(result?.errorCode, "expo-send-throw");
    assert.equal(result?.error, "network down");
  });
});

describe("ExpoPushProvider receipts", () => {
  it("maps a DeviceNotRegistered receipt to a delivery event and deactivates the token", async (): Promise<void> => {
    await setupDb();
    await Promise.all([CommsMessage.deleteMany({}), PushToken.deleteMany({})]);
    const userId = new mongoose.Types.ObjectId();
    const token = validToken("later-dead");
    await PushToken.create({
      active: true,
      lastSeenAt: DateTime.utc().toJSDate(),
      platform: "ios",
      token,
      userId,
    });

    const client = createMockClient({
      receipts: {
        "ticket-ok": {
          details: {error: "DeviceNotRegistered"},
          message: "The device cannot receive notifications",
          status: "error",
        },
      },
      tickets: [{id: "ticket-ok", status: "ok"}],
    });
    const events: DeliveryEvent[] = [];
    let poll: (() => Promise<void>) | undefined;
    const service = new CommsService({
      push: new ExpoPushProvider({
        client,
        onDeadToken: async (deadToken: string): Promise<void> => {
          await service.deactivatePushToken(deadToken);
        },
        onDeliveryEvent: async (event: DeliveryEvent): Promise<void> => {
          events.push(event);
          await service.recordDeliveryEvent(event);
        },
        receiptPollDelayMs: 15,
        scheduleReceiptPoll: (_delayMs, run): void => {
          poll = run;
        },
      }),
      redactRecipients: false,
    });

    const results = await service.sendPushToUser({
      body: "Hello",
      title: "Ping",
      userId,
    });
    assert.isTrue(results[0]?.accepted);
    assert.equal((await PushToken.findExactlyOne({token})).active, true);

    assert.isFunction(poll);
    await (poll as () => Promise<void>)();

    assert.equal(events.length, 1);
    assert.equal(events[0]?.errorCode, "DeviceNotRegistered");
    assert.equal(events[0]?.errorClass, "permanent");
    assert.equal(events[0]?.status, "failed");
    assert.equal((await PushToken.findExactlyOne({token})).active, false);
    assert.equal(
      (await CommsMessage.findExactlyOne({providerMessageId: "ticket-ok"})).status,
      "failed"
    );
  });

  it("records delivered receipts without deactivating the token", async (): Promise<void> => {
    await setupDb();
    await Promise.all([CommsMessage.deleteMany({}), PushToken.deleteMany({})]);
    const userId = new mongoose.Types.ObjectId();
    const token = validToken("alive");
    await PushToken.create({
      active: true,
      lastSeenAt: DateTime.utc().toJSDate(),
      platform: "ios",
      token,
      userId,
    });
    const client = createMockClient({
      receipts: {"ticket-ok": {status: "ok"}},
      tickets: [{id: "ticket-ok", status: "ok"}],
    });
    const events: DeliveryEvent[] = [];
    let poll: (() => Promise<void>) | undefined;
    const service = new CommsService({
      push: new ExpoPushProvider({
        client,
        onDeliveryEvent: async (event: DeliveryEvent): Promise<void> => {
          events.push(event);
          await service.recordDeliveryEvent(event);
        },
        receiptPollDelayMs: 0,
        scheduleReceiptPoll: (_delayMs, run): void => {
          poll = run;
        },
      }),
      redactRecipients: false,
    });

    await service.sendPushToUser({body: "Hello", title: "Ping", userId});
    await (poll as () => Promise<void>)();

    assert.equal(events[0]?.status, "delivered");
    assert.equal((await PushToken.findExactlyOne({token})).active, true);
    assert.equal(
      (await CommsMessage.findExactlyOne({providerMessageId: "ticket-ok"})).status,
      "delivered"
    );
  });

  it("drops pending receipt ids when the receipt poll throws", async (): Promise<void> => {
    await setupDb();
    await Promise.all([CommsMessage.deleteMany({}), PushToken.deleteMany({})]);
    const userId = new mongoose.Types.ObjectId();
    const token = validToken("poll-throw");
    await PushToken.create({
      active: true,
      lastSeenAt: DateTime.utc().toJSDate(),
      platform: "ios",
      token,
      userId,
    });
    const client = createMockClient({
      receipts: {
        "ticket-ok": {
          details: {error: "DeviceNotRegistered"},
          message: "The device cannot receive notifications",
          status: "error",
        },
      },
      tickets: [{id: "ticket-ok", status: "ok"}],
    });
    let pollCount = 0;
    client.getPushNotificationReceiptsAsync = async (
      ids: string[]
    ): Promise<Record<string, ExpoPushReceipt>> => {
      pollCount += 1;
      if (pollCount === 1) {
        throw new Error("expo receipts unavailable");
      }
      return {
        [ids[0] ?? "ticket-ok"]: {
          details: {error: "DeviceNotRegistered"},
          message: "The device cannot receive notifications",
          status: "error",
        },
      };
    };
    let poll: (() => Promise<void>) | undefined;
    const service = new CommsService({
      push: new ExpoPushProvider({
        client,
        onDeadToken: async (deadToken: string): Promise<void> => {
          await service.deactivatePushToken(deadToken);
        },
        receiptPollDelayMs: 0,
        scheduleReceiptPoll: (_delayMs, run): void => {
          poll = run;
        },
      }),
      redactRecipients: false,
    });

    await service.sendPushToUser({body: "Hello", title: "Ping", userId});
    await (poll as () => Promise<void>)();
    await (poll as () => Promise<void>)();

    assert.equal(pollCount, 2);
    assert.equal((await PushToken.findExactlyOne({token})).active, true);
  });
});
