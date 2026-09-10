import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import mongoose, {model, Schema} from "mongoose";

import {orgScopedPlugin} from "./orgPlugin";

interface OrgScopedWidget {
  organizationId: mongoose.Types.ObjectId;
  title: string;
}

const widgetSchema = new Schema<OrgScopedWidget>(
  {
    title: {description: "Widget title", type: String},
  },
  {strict: "throw"}
);
widgetSchema.plugin(orgScopedPlugin);

const OrgScopedWidgetModel =
  (mongoose.models.OrgScopedWidget as mongoose.Model<OrgScopedWidget> | undefined) ??
  model<OrgScopedWidget>("OrgScopedWidget", widgetSchema);

describe("orgScopedPlugin", () => {
  beforeEach(async () => {
    await OrgScopedWidgetModel.deleteMany({});
    await OrgScopedWidgetModel.syncIndexes();
  });

  it("rejects a save when organizationId is missing", async () => {
    let error: unknown;
    try {
      await OrgScopedWidgetModel.create({title: "No org"});
    } catch (caughtError) {
      error = caughtError;
    }

    assert.instanceOf(error, Error);
    assert.match((error as Error).message, /organizationId/i);
  });

  it("indexes organizationId on the consumer collection", async () => {
    const indexes = await OrgScopedWidgetModel.collection.indexes();
    const orgIndex = indexes.find((index) => {
      return index.key.organizationId === 1;
    });

    assert.isDefined(orgIndex);

    const saved = await OrgScopedWidgetModel.create({
      organizationId: new mongoose.Types.ObjectId(),
      title: "Scoped",
    });
    assert.isDefined(saved.organizationId);
  });
});
