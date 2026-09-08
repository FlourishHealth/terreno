import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {assert} from "chai";
import {describe, it} from "bun:test";
import {
  compareExpoVersions,
  decideProbe,
  isResumableLoop,
  maxExpoVersion,
  parseExpoVersion,
  pickUpstreamCandidate,
  releaseBranchFromSdkLine,
  sdkLineFromExpoVersion,
  stripVersionRange,
  type TrackedState,
} from "../track-upstream-expo/compare.ts";
import {
  ORIGIN_RELEASE_BRANCH_FETCH_REFSPEC,
  originFetchCommand,
  originTrackedShowSpec,
} from "../track-upstream-expo/remoteTracked.ts";

const trackedOnMaster = (): TrackedState => ({
  expoVersion: "57.0.14",
  loopStatus: "idle",
  npmTag: "latest",
  releaseBranch: null,
  sdkLine: "57.0.0",
  updatedAt: "2026-09-07T00:00:00.000Z",
});

const trackedOnRelease = (overrides: Partial<TrackedState> = {}): TrackedState => ({
  expoVersion: "58.0.0-preview.1",
  loopStatus: "open",
  npmTag: "next",
  releaseBranch: "release-58.0.0",
  sdkLine: "58.0.0",
  updatedAt: "2026-09-08T00:00:00.000Z",
  ...overrides,
});

describe("track-upstream-expo compare", (): void => {
  it("strips catalog ranges", (): void => {
    assert.equal(stripVersionRange("~57.0.14"), "57.0.14");
    assert.equal(stripVersionRange("^58.0.0-preview.1"), "58.0.0-preview.1");
  });

  it("orders preview builds before stable of the same sdk line", (): void => {
    assert.isBelow(compareExpoVersions("58.0.0-preview.1", "58.0.0-preview.2"), 0);
    assert.isBelow(compareExpoVersions("58.0.0-preview.9", "58.0.0"), 0);
    assert.equal(compareExpoVersions("58.0.0", "58.0.0"), 0);
    assert.deepEqual(parseExpoVersion("58.0.0-preview.2"), {
      major: 58,
      minor: 0,
      patch: 0,
      prerelease: ["preview", 2],
    });
  });

  it("maps a beta to release-MAJOR.MINOR.PATCH", (): void => {
    assert.equal(sdkLineFromExpoVersion("58.0.0-preview.1"), "58.0.0");
    assert.equal(releaseBranchFromSdkLine("58.0.0"), "release-58.0.0");
  });

  it("ignores patches of the current catalog major", (): void => {
    const candidate = pickUpstreamCandidate({
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.15", next: "57.0.16-preview.0"},
    });
    assert.isNull(candidate);
  });

  it("picks the highest next-major tag", (): void => {
    const candidate = pickUpstreamCandidate({
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14", next: "58.0.0-preview.1"},
    });
    assert.deepEqual(candidate, {npmTag: "next", version: "58.0.0-preview.1"});
  });

  it("fails closed when the same beta is already tracked and the loop is ready", (): void => {
    const none = decideProbe({
      branchTracked: trackedOnRelease({loopStatus: "ready"}),
      existingReleaseBranches: ["release-58.0.0"],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14", next: "58.0.0-preview.1"},
      tracked: trackedOnMaster(),
    });
    assert.equal(none.action, "none");
    assert.include(none.reason, "Already tracking");
    assert.isFalse(isResumableLoop("ready"));
    assert.isFalse(isResumableLoop("idle"));
  });

  it("resumes an open loop on the same beta", (): void => {
    const resumed = decideProbe({
      branchTracked: trackedOnRelease({loopStatus: "open"}),
      existingReleaseBranches: ["release-58.0.0"],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14", next: "58.0.0-preview.1"},
      tracked: trackedOnMaster(),
    });
    assert.equal(resumed.action, "resume-loop");
    assert.equal(resumed.releaseBranch, "release-58.0.0");
    assert.equal(resumed.expoVersion, "58.0.0-preview.1");
    assert.isTrue(isResumableLoop("open"));
    assert.isTrue(isResumableLoop("blocked"));
  });

  it("resumes an in-flight loop when npm has no newer major", (): void => {
    const resumed = decideProbe({
      branchTracked: trackedOnRelease({loopStatus: "blocked"}),
      existingReleaseBranches: ["release-58.0.0"],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14"},
      tracked: trackedOnMaster(),
    });
    assert.equal(resumed.action, "resume-loop");
    assert.equal(resumed.loopStatus, "blocked");
    assert.include(resumed.reason, "release-58.0.0");
  });

  it("creates the release branch from a stable next major on latest", (): void => {
    const created = decideProbe({
      branchTracked: null,
      existingReleaseBranches: [],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "58.0.0"},
      tracked: trackedOnMaster(),
    });
    assert.equal(created.action, "create-branch");
    assert.equal(created.releaseBranch, "release-58.0.0");
    assert.equal(created.npmTag, "latest");
    assert.equal(created.loopStatus, "open");
  });

  it("creates release-58.0.0 for the first 58 beta", (): void => {
    const created = decideProbe({
      branchTracked: null,
      existingReleaseBranches: ["release-56.0.0"],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14", next: "58.0.0-preview.1"},
      tracked: trackedOnMaster(),
    });
    assert.equal(created.action, "create-branch");
    assert.equal(created.releaseBranch, "release-58.0.0");
    assert.equal(created.expoVersion, "58.0.0-preview.1");
  });

  it("continues the existing branch for a newer preview", (): void => {
    const continued = decideProbe({
      branchTracked: trackedOnRelease(),
      existingReleaseBranches: ["release-58.0.0"],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14", next: "58.0.0-preview.2"},
      tracked: trackedOnRelease(),
    });
    assert.equal(continued.action, "continue-branch");
    assert.equal(continued.expoVersion, "58.0.0-preview.2");
    assert.equal(maxExpoVersion(["58.0.0-preview.1", "57.0.14"]), "58.0.0-preview.1");
  });

  it("fetches remote release-* refs before git show", (): void => {
    assert.deepEqual(originFetchCommand(), [
      "git",
      "fetch",
      "--no-tags",
      "origin",
      ORIGIN_RELEASE_BRANCH_FETCH_REFSPEC,
    ]);
    assert.equal(
      originTrackedShowSpec("release-58.0.0"),
      "origin/release-58.0.0:scripts/track-upstream-expo/tracked.json"
    );
    assert.throws((): void => {
      originTrackedShowSpec("origin/release-58.0.0");
    }, /Invalid release branch/);
  });

  it("keeps the committed loop log headings", (): void => {
    const log = readFileSync(
      resolve(import.meta.dir, "../track-upstream-expo/loop-log.md"),
      "utf8"
    );
    for (const heading of [
      "## Status",
      "## Next",
      "## Open",
      "## Tried (newest first)",
      "## Do not retry",
      "## Worked",
      "## Release notes draft",
    ]) {
      assert.include(log, heading);
    }
  });
});
