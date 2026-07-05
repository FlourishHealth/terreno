// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {beforeAll, beforeEach, describe, expect, it} from "bun:test";
import mongoose, {model, Schema} from "mongoose";
import type {ModelRouterOptions} from "../api";
import type {User} from "../auth";
import {APIError} from "../errors";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {setupDb} from "../tests";
import {SyncCounter, SyncMutation} from "./models";
import {applySyncMutation, type SyncMutationOutcome} from "./mutationHandler";
import {clearSyncRegistry, registerSync} from "./registry";
import {syncPlugin} from "./syncSeqPlugin";
import type {SyncMutateRequest} from "./types";

interface MutStuff extends IsDeleted {
  _id: string;
  name: string;
  ownerId: string;
  created: Date;
  _syncSeq?: number;
}

const mutStuffSchema = new Schema<MutStuff>({
  name: {description: "The name of the item", required: true, type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
mutStuffSchema.plugin(isDeletedPlugin);
mutStuffSchema.plugin(createdUpdatedPlugin);
mutStuffSchema.plugin(syncPlugin);
const MutStuffModel = model<MutStuff>("MutStuff", mutStuffSchema);

const owner = {_id: "mut-owner", admin: false, id: "mut-owner"} as unknown as User;
const stranger = {_id: "mut-stranger", admin: false, id: "mut-stranger"} as unknown as User;

const ownerOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsOwner],
    list: [Permissions.IsAny],
    read: [Permissions.IsAny],
    update: [Permissions.IsOwner],
  },
} as unknown as ModelRouterOptions<any>;

const registerMutStuff = (overrides: Partial<Record<string, unknown>> = {}): void => {
  clearSyncRegistry();
  registerSync({
    config: {scope: {type: "owner"}, ...(overrides.config as object)},
    model: MutStuffModel as any,
    options: (overrides.options as ModelRouterOptions<any>) ?? ownerOptions,
    routePath: "/mutStuff",
  });
};

const expectAck = (outcome: SyncMutationOutcome) => {
  expect(outcome.type).toBe("ack");
  if (outcome.type !== "ack") {
    throw new Error("expected ack");
  }
  return outcome.ack;
};

const expectNack = (outcome: SyncMutationOutcome) => {
  expect(outcome.type).toBe("nack");
  if (outcome.type !== "nack") {
    throw new Error("expected nack");
  }
  return outcome.nack;
};

describe("applySyncMutation", () => {
  beforeAll(async () => {
    await setupDb();
    // The shared test database can be dropped by another test file mid-suite
    // (configurationPlugin.test.ts drops it in an afterAll); rebuild the unique indexes
    // the idempotency tests depend on.
    await Promise.all([SyncCounter.ensureIndexes(), SyncMutation.ensureIndexes()]);
  });

  beforeEach(async () => {
    registerMutStuff();
    await Promise.all([
      MutStuffModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
      SyncMutation.deleteMany({}),
    ]);
  });

  describe("successful mutations", () => {
    it("applies a create and acks with the new id and seq", async () => {
      const outcome = await applySyncMutation({
        mutation: {
          collection: "mutStuff",
          data: {name: "created", ownerId: owner.id},
          mutationId: "m-create-1",
          operation: "create",
        },
        user: owner,
      });
      const ack = expectAck(outcome);
      expect(ack.mutationId).toBe("m-create-1");
      expect(ack.seq).toBe(1);

      const saved = await MutStuffModel.findById(ack.id);
      expect(saved?.name).toBe("created");
      expect(saved?._syncSeq).toBe(1);

      const row = await SyncMutation.findOne({mutationId: "m-create-1"});
      expect(row?.status).toBe("applied");
      expect(row?.resultId).toBe(ack.id);
      expect(row?.resultSeq).toBe(1);
    });

    it("honors a client-generated id on create", async () => {
      const id = new mongoose.Types.ObjectId().toString();
      const outcome = await applySyncMutation({
        mutation: {
          collection: "mutStuff",
          data: {name: "client id", ownerId: owner.id},
          id,
          mutationId: "m-create-id",
          operation: "create",
        },
        user: owner,
      });
      expect(expectAck(outcome).id).toBe(id);
      expect(await MutStuffModel.findById(id)).not.toBeNull();
    });

    it("applies an update with a matching baseVersion and advances the seq", async () => {
      const doc = await MutStuffModel.create({name: "original", ownerId: owner.id});
      expect(doc._syncSeq).toBe(1);

      const outcome = await applySyncMutation({
        mutation: {
          baseVersion: 1,
          collection: "mutStuff",
          data: {name: "changed"},
          id: doc._id.toString(),
          mutationId: "m-update-1",
          operation: "update",
        },
        user: owner,
      });
      const ack = expectAck(outcome);
      expect(ack.id).toBe(doc._id.toString());
      expect(ack.seq).toBe(2);
      const saved = await MutStuffModel.findById(doc._id);
      expect(saved?.name).toBe("changed");
    });

    it("applies a delete as a soft-delete tombstone and acks with the new seq", async () => {
      const doc = await MutStuffModel.create({name: "victim", ownerId: owner.id});
      const outcome = await applySyncMutation({
        mutation: {
          collection: "mutStuff",
          id: doc._id.toString(),
          mutationId: "m-delete-1",
          operation: "delete",
        },
        user: owner,
      });
      const ack = expectAck(outcome);
      expect(ack.seq).toBe(2);
      const tombstones = await MutStuffModel.find({_id: doc._id, deleted: true});
      expect(tombstones).toHaveLength(1);
    });
  });

  describe("idempotency", () => {
    it("returns the recorded ack for a duplicate mutationId without re-applying", async () => {
      const mutation: SyncMutateRequest = {
        collection: "mutStuff",
        data: {name: "once", ownerId: owner.id},
        mutationId: "m-dup-1",
        operation: "create",
      };
      const first = expectAck(await applySyncMutation({mutation, user: owner}));
      const second = expectAck(await applySyncMutation({mutation, user: owner}));

      expect(second).toEqual(first);
      expect(await MutStuffModel.countDocuments({name: "once"})).toBe(1);
      expect(await SyncMutation.countDocuments({mutationId: "m-dup-1"})).toBe(1);
    });

    it("applies exactly once when two deliveries race on the same mutationId", async () => {
      const mutation: SyncMutateRequest = {
        collection: "mutStuff",
        data: {name: "raced", ownerId: owner.id},
        mutationId: "m-race-1",
        operation: "create",
      };
      const [a, b] = await Promise.all([
        applySyncMutation({mutation, user: owner}),
        applySyncMutation({mutation, user: owner}),
      ]);
      const ackA = expectAck(a);
      const ackB = expectAck(b);
      expect(ackA).toEqual(ackB);
      expect(await MutStuffModel.countDocuments({name: "raced"})).toBe(1);
    });

    it("returns the recorded conflict nack for a duplicate conflicted mutation", async () => {
      const doc = await MutStuffModel.create({name: "server v1", ownerId: owner.id});
      doc.name = "server v2";
      await doc.save(); // seq 2

      const mutation: SyncMutateRequest = {
        baseVersion: 1,
        collection: "mutStuff",
        data: {name: "stale client"},
        id: doc._id.toString(),
        mutationId: "m-dup-conflict",
        operation: "update",
      };
      const first = expectNack(await applySyncMutation({mutation, user: owner}));
      const second = expectNack(await applySyncMutation({mutation, user: owner}));

      expect(first.code).toBe("conflict");
      expect(second.code).toBe("conflict");
      expect(second.serverSeq).toBe(first.serverSeq);
      expect((second.serverDoc as {name: string}).name).toBe("server v2");
    });

    it("returns the recorded nack for a duplicate failed mutation", async () => {
      const mutation: SyncMutateRequest = {
        collection: "mutStuff",
        data: {ownerId: owner.id}, // missing required name
        mutationId: "m-dup-failed",
        operation: "create",
      };
      const first = expectNack(await applySyncMutation({mutation, user: owner}));
      expect(first.code).toBe("validation");

      const second = expectNack(await applySyncMutation({mutation, user: owner}));
      expect(second.code).toBe("validation");
      expect(second.message).toBe(first.message);
      expect(await SyncMutation.countDocuments({mutationId: "m-dup-failed"})).toBe(1);
    });

    it("nacks unauthorized when the mutationId was claimed by another user", async () => {
      const mutation: SyncMutateRequest = {
        collection: "mutStuff",
        data: {name: "mine", ownerId: owner.id},
        mutationId: "m-cross-user",
        operation: "create",
      };
      expectAck(await applySyncMutation({mutation, user: owner}));

      const nack = expectNack(await applySyncMutation({mutation, user: stranger}));
      expect(nack.code).toBe("unauthorized");
      expect(nack.message).toContain("another user");
      // The original outcome is untouched.
      const row = await SyncMutation.findOne({mutationId: "m-cross-user"});
      expect(row?.status).toBe("applied");
    });

    it("nacks error when a claimed mutation stays pending past the poll timeout", async () => {
      await SyncMutation.create({
        mutationId: "m-stuck",
        status: "pending",
        userId: String(owner.id),
      });
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "mutStuff",
            data: {name: "stuck", ownerId: owner.id},
            mutationId: "m-stuck",
            operation: "create",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("error");
      expect(nack.message).toContain("still in flight");
      // The row is left pending for the owning delivery to finalize.
      const row = await SyncMutation.findOne({mutationId: "m-stuck"});
      expect(row?.status).toBe("pending");
      expect(await MutStuffModel.countDocuments({name: "stuck"})).toBe(0);
    });
  });

  describe("conflicts", () => {
    it("nacks conflict with the canonical server doc on a stale baseVersion", async () => {
      const doc = await MutStuffModel.create({name: "v1", ownerId: owner.id});
      doc.name = "v2";
      await doc.save(); // seq 2

      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            baseVersion: 1,
            collection: "mutStuff",
            data: {name: "stale"},
            id: doc._id.toString(),
            mutationId: "m-conflict-1",
            operation: "update",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("conflict");
      expect(nack.serverSeq).toBe(2);
      expect((nack.serverDoc as {name: string}).name).toBe("v2");

      const saved = await MutStuffModel.findById(doc._id);
      expect(saved?.name).toBe("v2");
      const row = await SyncMutation.findOne({mutationId: "m-conflict-1"});
      expect(row?.status).toBe("conflicted");
      expect(row?.nackCode).toBe("conflict");
      expect(row?.resultSeq).toBe(2);
      expect((row?.serverDoc as {name: string}).name).toBe("v2");
    });

    it("serializes the conflict server doc through the sync responseHandler", async () => {
      registerMutStuff({
        config: {
          responseHandler: (doc: Record<string, unknown>) => ({redacted: `x-${doc.name}`}),
          scope: {type: "owner"},
        },
      });
      const doc = await MutStuffModel.create({name: "secret", ownerId: owner.id});
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            baseVersion: 99,
            collection: "mutStuff",
            data: {name: "stale"},
            id: doc._id.toString(),
            mutationId: "m-conflict-serialized",
            operation: "update",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("conflict");
      expect(nack.serverDoc).toEqual({redacted: "x-secret"});
    });

    it("nacks conflict without a server doc when serialization fails", async () => {
      registerMutStuff({
        config: {
          responseHandler: () => {
            throw new Error("serializer exploded");
          },
          scope: {type: "owner"},
        },
      });
      const doc = await MutStuffModel.create({name: "unserializable", ownerId: owner.id});
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            baseVersion: 99,
            collection: "mutStuff",
            data: {name: "stale"},
            id: doc._id.toString(),
            mutationId: "m-conflict-serialize-fail",
            operation: "update",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("conflict");
      expect(nack.serverSeq).toBe(1);
      expect(nack.serverDoc).toBeUndefined();
      const row = await SyncMutation.findOne({mutationId: "m-conflict-serialize-fail"});
      expect(row?.status).toBe("conflicted");
    });
  });

  describe("permissions", () => {
    it("nacks unauthorized when a non-owner updates a document", async () => {
      const doc = await MutStuffModel.create({name: "owned", ownerId: owner.id});
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            baseVersion: 1,
            collection: "mutStuff",
            data: {name: "hijacked"},
            id: doc._id.toString(),
            mutationId: "m-perm-1",
            operation: "update",
          },
          user: stranger,
        })
      );
      expect(nack.code).toBe("unauthorized");
      const saved = await MutStuffModel.findById(doc._id);
      expect(saved?.name).toBe("owned");
      const row = await SyncMutation.findOne({mutationId: "m-perm-1"});
      expect(row?.status).toBe("failed");
      expect(row?.nackCode).toBe("unauthorized");
    });

    it("nacks unauthorized for method-level (405) denials", async () => {
      registerMutStuff({
        options: {
          permissions: {
            create: [Permissions.IsAdmin],
            delete: [Permissions.IsAdmin],
            list: [Permissions.IsAdmin],
            read: [Permissions.IsAdmin],
            update: [Permissions.IsAdmin],
          },
        } as unknown as ModelRouterOptions<any>,
      });
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "mutStuff",
            data: {name: "nope", ownerId: owner.id},
            mutationId: "m-perm-2",
            operation: "create",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("unauthorized");
    });

    it("nacks unauthorized when a non-owner deletes a document", async () => {
      const doc = await MutStuffModel.create({name: "keep", ownerId: owner.id});
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "mutStuff",
            id: doc._id.toString(),
            mutationId: "m-perm-3",
            operation: "delete",
          },
          user: stranger,
        })
      );
      expect(nack.code).toBe("unauthorized");
      const saved = await MutStuffModel.findById(doc._id);
      expect(saved?.deleted).toBe(false);
    });
  });

  describe("validation", () => {
    it("nacks validation when a required field is missing", async () => {
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "mutStuff",
            data: {ownerId: owner.id},
            mutationId: "m-invalid-1",
            operation: "create",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("validation");
      const row = await SyncMutation.findOne({mutationId: "m-invalid-1"});
      expect(row?.status).toBe("failed");
      expect(row?.nackCode).toBe("validation");
    });

    it("nacks validation for an unknown collection", async () => {
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "nope",
            data: {name: "x"},
            mutationId: "m-invalid-2",
            operation: "create",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("validation");
      expect(nack.message).toContain("Unknown sync collection");
    });

    it("nacks validation when update or delete is missing an id", async () => {
      for (const operation of ["update", "delete"] as const) {
        const nack = expectNack(
          await applySyncMutation({
            mutation: {
              collection: "mutStuff",
              data: {name: "x"},
              mutationId: `m-noid-${operation}`,
              operation,
            },
            user: owner,
          })
        );
        expect(nack.code).toBe("validation");
        expect(nack.message).toContain("id is required");
      }
    });

    it("nacks validation when mutationId or collection is missing", async () => {
      const noMutationId = expectNack(
        await applySyncMutation({
          mutation: {collection: "mutStuff", operation: "create"} as SyncMutateRequest,
          user: owner,
        })
      );
      expect(noMutationId.code).toBe("validation");
      expect(noMutationId.mutationId).toBe("");

      const noCollection = expectNack(
        await applySyncMutation({
          mutation: {mutationId: "m-nocoll", operation: "create"} as SyncMutateRequest,
          user: owner,
        })
      );
      expect(noCollection.code).toBe("validation");
      expect(noCollection.message).toContain("collection");
    });

    it("nacks validation for an unknown operation", async () => {
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "mutStuff",
            mutationId: "m-badop",
            operation: "upsert",
          } as unknown as SyncMutateRequest,
          user: owner,
        })
      );
      expect(nack.code).toBe("validation");
      expect(nack.message).toContain("Unknown operation");
    });

    it("nacks validation when the target document does not exist", async () => {
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            baseVersion: 0,
            collection: "mutStuff",
            data: {name: "ghost"},
            id: new mongoose.Types.ObjectId().toString(),
            mutationId: "m-missing-doc",
            operation: "update",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("validation");
    });
  });

  describe("errors", () => {
    it("nacks error for unexpected server failures and records the message", async () => {
      registerMutStuff({
        options: {
          ...ownerOptions,
          preCreate: () => {
            throw new APIError({status: 500, title: "database exploded"});
          },
        } as unknown as ModelRouterOptions<any>,
      });
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "mutStuff",
            data: {name: "boom", ownerId: owner.id},
            mutationId: "m-error-1",
            operation: "create",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("error");
      expect(nack.message).toBe("database exploded");
      const row = await SyncMutation.findOne({mutationId: "m-error-1"});
      expect(row?.status).toBe("failed");
      expect(row?.nackCode).toBe("error");
      expect(row?.error).toBe("database exploded");
    });

    it("nacks error when a non-APIError escapes the executor pipeline", async () => {
      registerMutStuff({
        options: {
          permissions: {
            create: [
              () => {
                throw new Error("permission crashed");
              },
            ],
            delete: [Permissions.IsOwner],
            list: [Permissions.IsAny],
            read: [Permissions.IsAny],
            update: [Permissions.IsOwner],
          },
        } as unknown as ModelRouterOptions<any>,
      });
      const nack = expectNack(
        await applySyncMutation({
          mutation: {
            collection: "mutStuff",
            data: {name: "crash", ownerId: owner.id},
            mutationId: "m-plain-error",
            operation: "create",
          },
          user: owner,
        })
      );
      expect(nack.code).toBe("error");
      expect(nack.message).toContain("permission crashed");
      const row = await SyncMutation.findOne({mutationId: "m-plain-error"});
      expect(row?.status).toBe("failed");
      expect(row?.nackCode).toBe("error");
    });
  });
});
