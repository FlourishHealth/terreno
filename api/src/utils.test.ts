import {describe, expect, it, spyOn} from "bun:test";
import mongoose from "mongoose";

import {checkModelsStrict, isValidObjectId} from "./utils";

describe("utils", () => {
  describe("isValidObjectId", () => {
    it("checks valid ObjectIds", () => {
      expect(isValidObjectId("62c44da0003d9f8ee8cc925c")).toBe(true);
      expect(isValidObjectId("620000000000000000000000")).toBe(true);
      // Mongoose's builtin "ObjectId.isValid" will falsely say this is an ObjectId.
      expect(isValidObjectId("1234567890ab")).toBe(false);
      expect(isValidObjectId("microsoft123")).toBe(false);
      expect(isValidObjectId("62c44da0003d9f8ee8cc925x")).toBe(false);
    });
  });

  describe("checkModelsStrict", () => {
    it("throws error when toObject.virtuals is not true", () => {
      // Create a schema without toObject.virtuals
      const testSchema = new mongoose.Schema({name: String});
      testSchema.set("strict", "throw");
      // Not setting toObject.virtuals

      if (mongoose.models.ToObjectTestModel) {
        delete mongoose.models.ToObjectTestModel;
      }
      mongoose.model("ToObjectTestModel", testSchema);

      try {
        // This should throw because ToObjectTestModel doesn't have toObject.virtuals
        expect(() => checkModelsStrict()).toThrow("toObject.virtuals not set to true");
      } finally {
        delete mongoose.models.ToObjectTestModel;
      }
    });

    it("throws error when toJSON.virtuals is not true", () => {
      // Create a schema with toObject.virtuals but without toJSON.virtuals
      const testSchema = new mongoose.Schema({name: String});
      testSchema.set("toObject", {virtuals: true});
      testSchema.set("strict", "throw");
      // Not setting toJSON.virtuals

      if (mongoose.models.ToJsonTestModel) {
        delete mongoose.models.ToJsonTestModel;
      }
      mongoose.model("ToJsonTestModel", testSchema);

      // Use spyOn to intercept modelNames and return only our test model
      const spy = spyOn(mongoose, "modelNames").mockReturnValue(["ToJsonTestModel"]);

      try {
        expect(() => checkModelsStrict()).toThrow("toJSON.virtuals not set to true");
      } finally {
        spy.mockRestore();
        delete mongoose.models.ToJsonTestModel;
      }
    });

    it("throws error when strict mode is not set to throw", () => {
      // Create a schema with virtuals but without strict mode
      const testSchema = new mongoose.Schema({name: String});
      testSchema.set("toObject", {virtuals: true});
      testSchema.set("toJSON", {virtuals: true});
      // Not setting strict to "throw"

      if (mongoose.models.StrictTestModel) {
        delete mongoose.models.StrictTestModel;
      }
      mongoose.model("StrictTestModel", testSchema);

      const spy = spyOn(mongoose, "modelNames").mockReturnValue(["StrictTestModel"]);

      try {
        expect(() => checkModelsStrict()).toThrow("is not set to strict mode");
      } finally {
        spy.mockRestore();
        delete mongoose.models.StrictTestModel;
      }
    });

    it("passes when all checks pass", () => {
      // Create a properly configured schema
      const testSchema = new mongoose.Schema({name: String});
      testSchema.set("toObject", {virtuals: true});
      testSchema.set("toJSON", {virtuals: true});
      testSchema.set("strict", "throw");

      if (mongoose.models.GoodTestModel) {
        delete mongoose.models.GoodTestModel;
      }
      mongoose.model("GoodTestModel", testSchema);

      const spy = spyOn(mongoose, "modelNames").mockReturnValue(["GoodTestModel"]);

      try {
        expect(() => checkModelsStrict()).not.toThrow();
      } finally {
        spy.mockRestore();
        delete mongoose.models.GoodTestModel;
      }
    });

    it("skips strict mode check for ignored models", () => {
      // Create a properly configured model
      const goodSchema = new mongoose.Schema({name: String});
      goodSchema.set("toObject", {virtuals: true});
      goodSchema.set("toJSON", {virtuals: true});
      goodSchema.set("strict", "throw");

      if (mongoose.models.GoodModel) {
        delete mongoose.models.GoodModel;
      }
      mongoose.model("GoodModel", goodSchema);

      // Create a model without strict mode that we'll ignore
      const badSchema = new mongoose.Schema({name: String});
      badSchema.set("toObject", {virtuals: true});
      badSchema.set("toJSON", {virtuals: true});
      // Not setting strict - should fail unless ignored

      if (mongoose.models.IgnoredModel) {
        delete mongoose.models.IgnoredModel;
      }
      mongoose.model("IgnoredModel", badSchema);

      const spy = spyOn(mongoose, "modelNames").mockReturnValue(["GoodModel", "IgnoredModel"]);

      try {
        // Without ignoring, should throw for IgnoredModel
        expect(() => checkModelsStrict()).toThrow("is not set to strict mode");

        // With ignoring IgnoredModel, should pass
        expect(() => checkModelsStrict(["IgnoredModel"])).not.toThrow();
      } finally {
        spy.mockRestore();
        delete mongoose.models.GoodModel;
        delete mongoose.models.IgnoredModel;
      }
    });

    it("handles multiple models and validates all", () => {
      // Create three properly configured models
      const schema1 = new mongoose.Schema({name: String});
      schema1.set("toObject", {virtuals: true});
      schema1.set("toJSON", {virtuals: true});
      schema1.set("strict", "throw");

      const schema2 = new mongoose.Schema({value: Number});
      schema2.set("toObject", {virtuals: true});
      schema2.set("toJSON", {virtuals: true});
      schema2.set("strict", "throw");

      const schema3 = new mongoose.Schema({active: Boolean});
      schema3.set("toObject", {virtuals: true});
      schema3.set("toJSON", {virtuals: true});
      schema3.set("strict", "throw");

      if (mongoose.models.MultiModel1) delete mongoose.models.MultiModel1;
      if (mongoose.models.MultiModel2) delete mongoose.models.MultiModel2;
      if (mongoose.models.MultiModel3) delete mongoose.models.MultiModel3;

      mongoose.model("MultiModel1", schema1);
      mongoose.model("MultiModel2", schema2);
      mongoose.model("MultiModel3", schema3);

      const spy = spyOn(mongoose, "modelNames").mockReturnValue([
        "MultiModel1",
        "MultiModel2",
        "MultiModel3",
      ]);

      try {
        expect(() => checkModelsStrict()).not.toThrow();
      } finally {
        spy.mockRestore();
        delete mongoose.models.MultiModel1;
        delete mongoose.models.MultiModel2;
        delete mongoose.models.MultiModel3;
      }
    });

    it("handles empty model list", () => {
      const spy = spyOn(mongoose, "modelNames").mockReturnValue([]);

      try {
        expect(() => checkModelsStrict()).not.toThrow();
      } finally {
        spy.mockRestore();
      }
    });
  });
});
