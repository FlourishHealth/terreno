import {afterEach, beforeEach, describe, it} from "bun:test";
import {authAsUser as authWithCredentials} from "@terreno/test";
import {assert} from "chai";
import type express from "express";
import {DateTime} from "luxon";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import {signupUser, type UserModel as UserMongooseModel} from "../auth";
import {Notification} from "../models/notification";
import {NotificationPreference} from "../models/notificationPreference";
import {clearSyncRegistry} from "../sync/registry";
import {SyncApp} from "../sync/syncApp";
import {TerrenoApp} from "../terrenoApp";
import {authAsUser, setupDb, UserModel} from "../tests";
import {configureNotificationService, getNotificationService} from "./notificationService";
import {NotificationsApp} from "./notificationsApp";
import {notificationsBeforeSend} from "./notificationsBeforeSend";

interface FakeComms {
  mailCalls: Array<{subject: string; to: string}>;
  pushCalls: Array<{title: string; userId: string}>;
  smsCalls: Array<{body: string; to: string}>;
}

const buildFakeComms = (): {
  comms: FakeComms;
  getComms: () => FakeComms & {
    sendMail: (message: {subject: string; to: string}) => Promise<{accepted: boolean}>;
    sendPushToUser: (message: {title: string; userId: string}) => Promise<unknown[]>;
    sendSms: (message: {body: string; to: string}) => Promise<{accepted: boolean}>;
  };
} => {
  const comms: FakeComms = {mailCalls: [], pushCalls: [], smsCalls: []};
  return {
    comms,
    getComms: () => ({
      ...comms,
      sendMail: async (message) => {
        comms.mailCalls.push(message);
        return {accepted: true};
      },
      sendPushToUser: async (message) => {
        comms.pushCalls.push(message);
        return [{accepted: true}];
      },
      sendSms: async (message) => {
        comms.smsCalls.push(message);
        return {accepted: true};
      },
    }),
  };
};

const buildApp = (
  options: {
    getComms?: () => ReturnType<typeof buildFakeComms>["getComms"];
    retainDays?: number;
  } = {}
): express.Application => {
  clearSyncRegistry();
  return new TerrenoApp({
    skipListen: true,
    userModel: UserModel as unknown as UserMongooseModel,
  })
    .register(new SyncApp({}))
    .register(
      new NotificationsApp({
        getComms: options.getComms,
        retainDays: options.retainDays,
        userModel: UserModel,
      })
    )
    .build();
};

describe("NotificationsApp", () => {
  let userAgent: TestAgent;
  let otherUserAgent: TestAgent;
  let userId = "";

  const clearNotificationData = async (): Promise<void> => {
    await Notification.collection.deleteMany({});
    await NotificationPreference.collection.deleteMany({});
  };

  beforeEach(async () => {
    const [, notAdmin] = await setupDb();
    userId = String(notAdmin._id);
    const app = buildApp();
    userAgent = await authAsUser(app, "notAdmin");
    await UserModel.deleteOne({email: "other-user@example.com"});
    await signupUser(UserModel, "other-user@example.com", "password");
    otherUserAgent = await authWithCredentials(app, {
      email: "other-user@example.com",
      password: "password",
    });
    await clearNotificationData();
    await UserModel.updateOne({_id: notAdmin._id}, {phone: "+15551234567"});
  });

  afterEach(async () => {
    configureNotificationService({});
    await clearNotificationData();
  });

  it("notify creates one owner row when inapp is on", async () => {
    const id = await getNotificationService().notify({
      body: "Hello",
      title: "Welcome",
      userId,
    });
    assert.isString(id);
    assert.isNotEmpty(id);
    const row = await Notification.findExactlyOne({_id: id});
    assert.equal(String(row.ownerId), userId);
    assert.equal(row.title, "Welcome");
  });

  it("notify does not insert when inapp preference is off", async () => {
    await NotificationPreference.create({inapp: false, ownerId: userId});
    const id = await getNotificationService().notify({
      body: "Hidden",
      title: "Off",
      userId,
    });
    assert.equal(id, "");
    assert.equal(await Notification.countDocuments({ownerId: userId}), 0);
  });

  it("rejects unauthenticated list", async () => {
    const app = buildApp();
    await supertest(app).get("/notifications").expect(401);
  });

  it("blocks other users from reading a notification", async () => {
    const id = await getNotificationService().notify({
      body: "Private",
      title: "Mine",
      userId,
    });
    await otherUserAgent.get(`/notifications/${id}`).expect(403);
  });

  it("rejects HTTP create on notifications", async () => {
    await userAgent
      .post("/notifications")
      .send({body: "x", ownerId: userId, title: "y"})
      .expect(405);
  });

  it("PATCH readAt persists and strips other fields", async () => {
    const id = await getNotificationService().notify({
      body: "Body",
      title: "Original",
      userId,
    });
    const readAt = DateTime.now().toISO();
    await userAgent.patch(`/notifications/${id}`).send({readAt, title: "Hacked"}).expect(200);
    const row = await Notification.findExactlyOne({_id: id});
    assert.equal(row.title, "Original");
    assert.isOk(row.readAt);
  });

  it("DELETE soft-deletes from list", async () => {
    const id = await getNotificationService().notify({
      body: "Body",
      title: "Dismiss me",
      userId,
    });
    await userAgent.delete(`/notifications/${id}`).expect(204);
    const list = await userAgent.get("/notifications").expect(200);
    assert.equal(list.body.data.length, 0);
  });

  it("notificationsBeforeSend cancels mail when mail pref is false", async () => {
    await NotificationPreference.create({mail: false, ownerId: userId});
    const result = await notificationsBeforeSend({channel: "mail", userId});
    assert.deepEqual(result, {cancel: true});
  });

  it("notificationsBeforeSend does not cancel when preference row is missing", async () => {
    const result = await notificationsBeforeSend({channel: "mail", userId});
    assert.isUndefined(result);
  });

  it("notificationsBeforeSend never cancels verification", async () => {
    await NotificationPreference.create({
      inapp: false,
      mail: false,
      ownerId: userId,
      push: false,
      sms: false,
    });
    const result = await notificationsBeforeSend({channel: "verification", userId});
    assert.isUndefined(result);
  });

  it("fan-out calls mail when pref on and email present", async () => {
    const {comms, getComms} = buildFakeComms();
    configureNotificationService({getComms, userModel: UserModel});
    await getNotificationService().notify({
      body: "Body",
      title: "Mail me",
      userId,
    });
    assert.equal(comms.mailCalls.length, 1);
    assert.equal(comms.mailCalls[0]?.to, "notAdmin@example.com");
  });

  it("fan-out skips mail when pref off", async () => {
    const {comms, getComms} = buildFakeComms();
    configureNotificationService({getComms, userModel: UserModel});
    await NotificationPreference.create({mail: false, ownerId: userId});
    await getNotificationService().notify({
      body: "Body",
      title: "No mail",
      userId,
    });
    assert.equal(comms.mailCalls.length, 0);
  });

  it("notify resolves when getComms throws after inbox write", async () => {
    configureNotificationService({
      getComms: () => {
        throw new Error("comms down");
      },
      userModel: UserModel,
    });
    const id = await getNotificationService().notify({
      body: "Still here",
      title: "Resilient",
      userId,
    });
    assert.isNotEmpty(id);
  });

  it("mark-all-read only affects caller", async () => {
    const otherUserId = String((await UserModel.findOne({email: "admin@example.com"}))?._id);
    await getNotificationService().notify({body: "A", title: "A", userId});
    await getNotificationService().notify({body: "B", title: "B", userId: otherUserId});
    await userAgent.post("/notifications/mark-all-read").expect(200);
    const mine = await Notification.find({ownerId: userId});
    const theirs = await Notification.find({ownerId: otherUserId});
    assert.isOk(mine[0]?.readAt);
    assert.isNull(theirs[0]?.readAt ?? null);
  });

  it("retainDays 0 leaves old rows", async () => {
    const row = await Notification.create({
      body: "Old",
      created: DateTime.now().minus({days: 3}).toJSDate(),
      ownerId: userId,
      title: "Old",
    });
    configureNotificationService({retainDays: 0, userModel: UserModel});
    const swept = await getNotificationService().sweepExpired();
    assert.equal(swept, 0);
    const stillThere = await Notification.findById(row._id);
    assert.isFalse(stillThere?.deleted);
  });

  it("retainDays 1 tombstones rows older than one day", async () => {
    configureNotificationService({retainDays: 1, userModel: UserModel});
    const row = await Notification.create({
      body: "Stale",
      created: DateTime.now().minus({days: 2}).toJSDate(),
      ownerId: userId,
      title: "Stale",
    });
    const swept = await getNotificationService().sweepExpired();
    assert.equal(swept, 1);
    const tombstoned = await Notification.findOne({_id: row._id, deleted: true});
    assert.isTrue(tombstoned?.deleted);
  });

  it("notification collection has no TTL index", async () => {
    const indexes = await Notification.collection.indexes();
    const ttl = indexes.find((index) => "expireAfterSeconds" in index);
    assert.isUndefined(ttl);
  });
});
