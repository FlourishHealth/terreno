import {describe, it} from "bun:test";
import {existsSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {assert} from "chai";

const require = createRequire(import.meta.url);
const {
  notReadyTaggedRevisionNames,
  pruneNotReadyTaggedTraffic,
  readyRevisionNames,
  updateTrafficFlags,
} = require("./prune-cloud-run-not-ready-traffic.js") as {
  notReadyTaggedRevisionNames: (input: {
    readyNames: string[];
    traffic: Array<{revisionName?: string; tag?: string}>;
  }) => string[];
  pruneNotReadyTaggedTraffic: (input: {
    readyNames: string[];
    traffic: Array<{latestRevision?: boolean; percent?: number; revisionName?: string; tag?: string}>;
  }) => Array<{latestRevision?: boolean; percent?: number; revisionName?: string; tag?: string}>;
  readyRevisionNames: (revisions: unknown[]) => string[];
  updateTrafficFlags: (
    traffic: Array<{percent?: number; revisionName?: string; tag?: string}>
  ) => string[];
};

describe("pruneNotReadyTaggedTraffic", () => {
  it("drops a 0% tag whose revision is not Ready and keeps live plus ready tags", (): void => {
    const pruned = pruneNotReadyTaggedTraffic({
      readyNames: ["terreno-backend-example-00019-jv6", "terreno-backend-example-00014-cs4"],
      traffic: [
        {percent: 0, revisionName: "terreno-backend-example-00014-cs4", tag: "pr-1"},
        {percent: 100, revisionName: "terreno-backend-example-00019-jv6"},
        {percent: 0, revisionName: "terreno-backend-example-02011-son", tag: "pr-1300"},
      ],
    });

    assert.deepEqual(pruned, [
      {percent: 0, revisionName: "terreno-backend-example-00014-cs4", tag: "pr-1"},
      {percent: 100, revisionName: "terreno-backend-example-00019-jv6"},
    ]);
  });

  it("builds update-traffic flags that replace tags instead of removing one tag", (): void => {
    const flags = updateTrafficFlags([
      {percent: 0, revisionName: "terreno-backend-example-00014-cs4", tag: "pr-1"},
      {percent: 100, revisionName: "terreno-backend-example-00019-jv6"},
    ]);

    assert.deepEqual(flags, [
      "--to-revisions=terreno-backend-example-00019-jv6=100",
      "--set-tags=pr-1=terreno-backend-example-00014-cs4",
    ]);
  });

  it("clears tags when only the live revision remains", (): void => {
    const flags = updateTrafficFlags([{percent: 100, revisionName: "live-rev"}]);
    assert.deepEqual(flags, ["--to-revisions=live-rev=100", "--clear-tags"]);
  });

  it("lists tagged revisions that are not Ready", (): void => {
    const dropped = notReadyTaggedRevisionNames({
      readyNames: ["live-rev"],
      traffic: [
        {revisionName: "live-rev", tag: "pr-1"},
        {revisionName: "failed-rev", tag: "pr-1300"},
        {revisionName: "failed-rev", tag: "stale"},
      ],
    });
    assert.deepEqual(dropped, ["failed-rev"]);
  });

  it("treats Ready=True conditions as ready revisions", (): void => {
    const names = readyRevisionNames([
      {
        metadata: {name: "ready-rev"},
        status: {
          conditions: [{status: "True", type: "Ready"}],
        },
      },
      {
        metadata: {name: "failed-rev"},
        status: {
          conditions: [{status: "False", type: "Ready"}],
        },
      },
    ]);
    assert.deepEqual(names, ["ready-rev"]);
  });

  it("resolves 100% latestRevision from status.traffic when spec omits revisionName", (): void => {
    const {flagsFromDescribe} = require("./prune-cloud-run-not-ready-traffic.js") as {
      flagsFromDescribe: (input: {revisions: unknown[]; service: unknown}) => string[];
    };
    const flags = flagsFromDescribe({
      revisions: [
        {
          metadata: {name: "live-rev"},
          status: {conditions: [{status: "True", type: "Ready"}]},
        },
      ],
      service: {
        spec: {traffic: [{latestRevision: true, percent: 100}]},
        status: {traffic: [{percent: 100, revisionName: "live-rev"}]},
      },
    });
    assert.deepEqual(flags, ["--to-revisions=live-rev=100", "--clear-tags"]);
  });

  it("resolves the prune CLI from the workflow script directory", (): void => {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const workflowScriptDir = join(thisDir, "../workflows/scripts");
    const cliPath = join(
      workflowScriptDir,
      "../../../.github/scripts/prune-cloud-run-not-ready-traffic.js"
    );
    assert.isTrue(existsSync(cliPath));
  });
});
