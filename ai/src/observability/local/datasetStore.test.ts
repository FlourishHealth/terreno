import {afterEach, beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import {DateTime} from "luxon";

import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";
import {LocalDatasetStore} from "./datasetStore";
import {createLocalObservabilityBundle} from "./localPlugin";
import {registerObsDataset} from "./models/obsDataset";
import {registerObsDatasetItem} from "./models/obsDatasetItem";
import {registerObsTrace} from "./models/obsTrace";
import {LocalPromptStore} from "./promptStore";

describe("LocalDatasetStore", () => {
  let store: LocalDatasetStore;
  let promptStore: LocalPromptStore;

  beforeEach(async () => {
    createLocalObservabilityBundle();
    promptStore = new LocalPromptStore();
    store = new LocalDatasetStore(promptStore);
    await registerObsDataset().deleteMany({});
    await registerObsDatasetItem().deleteMany({});
    await registerObsTrace().deleteMany({});
    new ObservabilityApp({plugins: [createLocalObservabilityBundle().plugin]});
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  it("imports JSON rows and validates bound input schemas", async () => {
    await promptStore.create({
      folder: "examples",
      inputSchema: {
        properties: {text: {type: "string"}},
        required: ["text"],
        type: "object",
      },
      name: "bound-prompt",
      type: "text",
    });
    await promptStore.moveLabel("bound-prompt", {label: "production", version: 1});
    const dataset = await store.create({
      inputSchemaPromptName: "bound-prompt",
      name: "gold",
    });
    const ok = await store.importJson(dataset.id, [{text: "hello"}]);
    assert.equal(ok.created, 1);
    try {
      await store.createItem(dataset.id, {input: {text: 123}});
      assert.fail("expected schema failure");
    } catch (error) {
      assert.match(String(error), /\/text/);
    }
  });

  it("imports quoted CSV rows with nested input columns", async () => {
    const dataset = await store.create({name: "csv-set"});
    const csv = [
      "input.text,expectedOutput.answer,proofread,tags",
      '"hello, world","4",false,"gold|edge"',
    ].join("\n");
    const result = await store.importCsv(dataset.id, csv);
    assert.equal(result.created, 1);
    const items = await store.listItems(dataset.id);
    assert.deepEqual(items[0]?.input, {text: "hello, world"});
    assert.deepEqual(items[0]?.expectedOutput, {answer: 4});
    assert.equal(items[0]?.proofread, false);
    assert.deepEqual(items[0]?.tags, ["gold", "edge"]);
  });

  it("forces sensitive traces to proofread false and keeps sourceTraceId", async () => {
    const dataset = await store.create({name: "trace-set"});
    const trace = await registerObsTrace().create({
      input: {text: "secret"},
      name: "sensitive-trace",
      output: {answer: "hidden"},
      prompts: [],
      sensitive: true,
      startedAt: DateTime.utc().toJSDate(),
      status: "ok",
    });
    const [item] = await store.addTracesToDataset({
      datasetId: dataset.id,
      traceIds: [String(trace._id)],
    });
    assert.equal(item.proofread, false);
    assert.equal(item.sourceTraceId, String(trace._id));
    await store.removeItem(dataset.id, item.id);
    const reloaded = await registerObsTrace().findOneOrNone({_id: trace._id});
    assert.isOk(reloaded);
    assert.equal(reloaded?.sensitive, true);
  });

  it("includes human/auto/needsReview counts on list and detail", async () => {
    const dataset = await store.create({name: "counts"});
    await store.createItem(dataset.id, {input: {a: 1}, proofread: true});
    await store.createItem(dataset.id, {input: {a: 2}, proofread: false});
    const detail = await store.get(dataset.id);
    assert.equal(detail.counts.total, 2);
    assert.equal(detail.counts.human, 1);
    assert.equal(detail.counts.needsReview, 1);
  });
});
