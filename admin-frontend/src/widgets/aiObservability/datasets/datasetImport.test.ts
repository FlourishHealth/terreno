import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import {buildCsvImportPayload, buildJsonImportPayload, detectImportFormat} from "./datasetImport";

describe("datasetImport helpers", () => {
  it("builds JSON import payload from an array", () => {
    const payload = buildJsonImportPayload([{expectedOutput: {a: "ok"}, input: {q: "hi"}}]);
    assert.deepEqual(payload, {
      body: {rows: [{expectedOutput: {a: "ok"}, input: {q: "hi"}}]},
      formatLabel: "json",
    });
  });

  it("builds CSV import payload with format csv", () => {
    const payload = buildCsvImportPayload("input,expected\n{},{}");
    assert.equal(payload.formatLabel, "csv");
    assert.deepEqual(payload.body, {content: "input,expected\n{},{}", format: "csv"});
  });

  it("detects csv and json from filename and content", () => {
    expect(detectImportFormat("rows.csv", "a,b")).toBe("csv");
    expect(detectImportFormat("rows.json", '[{"input":{}}]')).toBe("json");
    expect(detectImportFormat("paste.txt", '[{"input":{}}]')).toBe("json");
  });
});
