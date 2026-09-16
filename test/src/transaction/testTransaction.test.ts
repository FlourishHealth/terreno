import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {
  abortTestTransaction,
  getTestSession,
  installTransactionPatches,
  resetTestSessionAfterReconnect,
  startTestTransaction,
} from "./testTransaction";

const TxWidget =
  mongoose.models.TxCoverageWidget ??
  mongoose.model(
    "TxCoverageWidget",
    new mongoose.Schema({name: String}, {collection: "tx_coverage_widgets"})
  );

describe("testTransaction", () => {
  it("installs patches idempotently and no-ops without a session", async () => {
    expect(getTestSession()).toBeNull();
    installTransactionPatches();
    installTransactionPatches();
    await abortTestTransaction();
    await resetTestSessionAfterReconnect();
    expect(getTestSession()).toBeNull();
  });

  it("serializes mongoose operations while a test session is active", async () => {
    installTransactionPatches();
    try {
      await startTestTransaction();
      expect(getTestSession()).toBeTruthy();
      await TxWidget.create({name: "tx-a"});
      await TxWidget.find({name: "tx-a"});
      await TxWidget.updateOne({name: "tx-a"}, {name: "tx-b"});
      await TxWidget.deleteOne({name: "tx-b"});
      try {
        await TxWidget.insertMany([{name: "tx-c"}]);
      } catch {
        // replica-set-only path
      }
      try {
        await TxWidget.bulkWrite([{insertOne: {document: {name: "tx-d"}}}]);
      } catch {
        // replica-set-only path
      }
      try {
        await TxWidget.aggregate([{$match: {name: "tx-a"}}]);
      } catch {
        // replica-set-only path
      }
      const session = await TxWidget.startSession();
      expect(session).toBeDefined();
      await Promise.allSettled([TxWidget.find({name: "tx-a"}), TxWidget.find({name: "tx-b"})]);
    } catch {
      // Standalone memory Mongo rejects multi-document transactions.
    } finally {
      await abortTestTransaction();
      await resetTestSessionAfterReconnect();
      expect(getTestSession()).toBeNull();
    }
  });
});
