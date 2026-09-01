import {beforeEach, describe, it, spyOn} from "bun:test";
import crypto from "node:crypto";
import {logger, TerrenoApp, type UserModel as UserModelType, WebhooksApp} from "@terreno/api";
import {setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import type {Application} from "express";
import supertest from "supertest";

import {type TwilioSmsClient, TwilioSmsProvider} from "../adapters/twilioSms";
import {CommsApp} from "../commsApp";
import {CommsMessage} from "../models/commsMessage";
import type {OptOutEvent} from "../types";

const AUTH_TOKEN = "twilio-auth-token";
const PUBLIC_URL = "https://api.example.test";
const STATUS_PATH = "/comms/webhooks/twilio/status";
const INBOUND_PATH = "/comms/webhooks/twilio/inbound";
const STATUS_URL = `${PUBLIC_URL}${STATUS_PATH}`;
const INBOUND_URL = `${PUBLIC_URL}${INBOUND_PATH}`;
const MESSAGE_SID = "SM123delivered";
const FAILED_SID = "SM123failed";

const createMockClient = (
  sid: string
): TwilioSmsClient & {calls: {params: {statusCallback?: string}}[]} => {
  const calls: {params: {statusCallback?: string}}[] = [];
  return {
    calls,
    messages: {
      create: async (params): Promise<{sid: string}> => {
        calls.push({params});
        return {sid};
      },
    },
  };
};

const twilioSignatureHeader = ({
  fields,
  url,
}: {
  fields: Record<string, string>;
  url: string;
}): string => {
  const keys = Object.keys(fields).sort();
  let data = url;
  for (const key of keys) {
    data += key + fields[key];
  }
  return crypto.createHmac("sha1", AUTH_TOKEN).update(data, "utf8").digest("base64");
};

const postTwilioForm = ({
  app,
  fields,
  path,
  signature,
  url,
}: {
  app: Application;
  fields: Record<string, string>;
  path: string;
  signature?: string;
  url: string;
}): Promise<supertest.Response> => {
  const request = supertest(app).post(path).type("form");
  if (signature !== undefined) {
    request.set("X-Twilio-Signature", signature);
  } else {
    request.set("X-Twilio-Signature", twilioSignatureHeader({fields, url}));
  }
  return request.send(fields);
};

const buildTwilioCommsApp = ({
  client,
  onOptOut,
  webhookPublicUrl = PUBLIC_URL,
  webhooks = new WebhooksApp({idempotency: {store: "memory"}}),
}: {
  client: TwilioSmsClient;
  onOptOut?: (event: OptOutEvent) => Promise<void>;
  webhookPublicUrl?: string;
  webhooks?: WebhooksApp;
}): {
  app: Application;
  comms: CommsApp;
  sms: TwilioSmsProvider;
  webhooks: WebhooksApp;
} => {
  const sms = new TwilioSmsProvider({
    accountSid: "ACtest",
    authToken: AUTH_TOKEN,
    client,
    fromNumber: "+15555550199",
  });
  const comms = new CommsApp({
    onOptOut,
    sms,
    webhookPublicUrl,
    webhooks,
  });
  const app = new TerrenoApp({
    logRequests: false,
    skipListen: true,
    userModel: UserModel as unknown as UserModelType,
  })
    .register(comms)
    .register(webhooks)
    .build();
  return {app, comms, sms, webhooks};
};

describe("Twilio CommsApp webhooks", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await CommsMessage.deleteMany({});
    Reflect.deleteProperty(process.env, "PUBLIC_API_URL");
    Reflect.deleteProperty(process.env, "COMMS_WEBHOOK_PUBLIC_URL");
  });

  it("updates CommsMessage to delivered from a signed status callback", async (): Promise<void> => {
    const client = createMockClient(MESSAGE_SID);
    const {app, comms} = buildTwilioCommsApp({client});
    await comms.service.sendSms({body: "Hello", to: "+14155552671"});

    const fields = {MessageSid: MESSAGE_SID, MessageStatus: "delivered"};
    const res = await postTwilioForm({app, fields, path: STATUS_PATH, url: STATUS_URL});

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    const row = await CommsMessage.findExactlyOne({providerMessageId: MESSAGE_SID});
    assert.equal(row.status, "delivered");
  });

  it("maps failed + ErrorCode 21610 to permanent failed", async (): Promise<void> => {
    const client = createMockClient(FAILED_SID);
    const {app, comms} = buildTwilioCommsApp({client});
    await comms.service.sendSms({body: "Hello", to: "+14155552671"});

    const fields = {
      ErrorCode: "21610",
      MessageSid: FAILED_SID,
      MessageStatus: "failed",
    };
    const res = await postTwilioForm({app, fields, path: STATUS_PATH, url: STATUS_URL});

    assert.equal(res.status, 200);
    const row = await CommsMessage.findExactlyOne({providerMessageId: FAILED_SID});
    assert.equal(row.status, "failed");
    assert.equal(row.errorCode, "21610");
    assert.equal(row.errorClass, "permanent");
  });

  it("returns 401 webhook-signature-invalid for an unsigned status callback", async (): Promise<void> => {
    const client = createMockClient(MESSAGE_SID);
    const {app} = buildTwilioCommsApp({client});
    const res = await postTwilioForm({
      app,
      fields: {MessageSid: MESSAGE_SID, MessageStatus: "delivered"},
      path: STATUS_PATH,
      signature: "",
      url: STATUS_URL,
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "webhook-signature-invalid");
  });

  it("fires onOptOut with reason sms-stop for a signed STOP inbound", async (): Promise<void> => {
    const client = createMockClient("SMinbound");
    const optOuts: OptOutEvent[] = [];
    const {app} = buildTwilioCommsApp({
      client,
      onOptOut: async (event): Promise<void> => {
        optOuts.push(event);
      },
    });
    const fields = {
      Body: "STOP please",
      From: "+14155552671",
      MessageSid: "SMinbound",
    };
    const res = await postTwilioForm({
      app,
      fields,
      path: INBOUND_PATH,
      url: INBOUND_URL,
    });

    assert.equal(res.status, 200);
    assert.equal(optOuts.length, 1);
    assert.equal(optOuts[0]?.reason, "sms-stop");
    assert.equal(optOuts[0]?.channel, "sms");
    assert.equal(optOuts[0]?.to, "+14155552671");
  });

  it("does not mount Twilio webhook paths when webhooks is omitted", async (): Promise<void> => {
    const sms = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: AUTH_TOKEN,
      client: createMockClient("SM404"),
      fromNumber: "+15555550199",
    });
    const app = new TerrenoApp({
      logRequests: false,
      skipListen: true,
      userModel: UserModel as unknown as UserModelType,
    })
      .register(
        new CommsApp({
          sms,
          webhookPublicUrl: PUBLIC_URL,
        })
      )
      .build();

    const res = await supertest(app)
      .post(STATUS_PATH)
      .type("form")
      .send({MessageSid: "SM404", MessageStatus: "delivered"});

    assert.equal(res.status, 404);
  });

  it("skips Twilio routes and logs when the public URL is missing", async (): Promise<void> => {
    const errorSpy = spyOn(logger, "error");
    const webhooks = new WebhooksApp({idempotency: {store: "memory"}});
    const sms = new TwilioSmsProvider({
      accountSid: "ACtest",
      authToken: AUTH_TOKEN,
      client: createMockClient("SMskip"),
      fromNumber: "+15555550199",
    });
    const app = new TerrenoApp({
      logRequests: false,
      skipListen: true,
      userModel: UserModel as unknown as UserModelType,
    })
      .register(new CommsApp({sms, webhooks}))
      .register(webhooks)
      .build();

    const res = await supertest(app)
      .post(STATUS_PATH)
      .type("form")
      .send({MessageSid: "SMskip", MessageStatus: "delivered"});

    assert.equal(res.status, 404);
    assert.isTrue(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("Skipping Twilio webhook routes"))
    );
    errorSpy.mockRestore();
  });

  it("defaults statusCallbackUrl to the public Twilio status path", async (): Promise<void> => {
    const client = createMockClient("SMcallback");
    const {comms} = buildTwilioCommsApp({client});
    await comms.service.sendSms({body: "Hello", to: "+14155552671"});
    assert.equal(client.calls[0]?.params.statusCallback, STATUS_URL);
  });

  it("omits Twilio webhook paths from OpenAPI", async (): Promise<void> => {
    const {app} = buildTwilioCommsApp({client: createMockClient("SMopenapi")});
    const response = await supertest(app).get("/openapi.json").expect(200);
    assert.notProperty(response.body.paths, STATUS_PATH);
    assert.notProperty(response.body.paths, INBOUND_PATH);
  });
});
