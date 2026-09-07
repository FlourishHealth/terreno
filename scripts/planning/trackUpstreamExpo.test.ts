import {assert} from "chai";
import {describe, it} from "bun:test";
import {
  compareExpoVersions,
  decideProbe,
  maxExpoVersion,
  parseExpoVersion,
  pickUpstreamCandidate,
  releaseBranchFromSdkLine,
  sdkLineFromExpoVersion,
  stripVersionRange,
  type TrackedState,
} from "../track-upstream-expo/compare.ts";

const trackedOnMaster = (): TrackedState => ({
  expoVersion: "57.0.14",
  npmTag: "latest",
  releaseBranch: null,
  sdkLine: "57.0.0",
  updatedAt: "2026-09-07T00:00:00.000Z",
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

  it("fails closed when nothing is newer than tracked or the release branch", (): void => {
    const none = decideProbe({
      branchTrackedExpo: "58.0.0-preview.1",
      existingReleaseBranches: ["release-58.0.0"],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14", next: "58.0.0-preview.1"},
      tracked: trackedOnMaster(),
    });
    assert.equal(none.action, "none");
    assert.include(none.reason, "Already tracking");
  });

  it("creates the release branch from a stable next major on latest", (): void => {
    const created = decideProbe({
      branchTrackedExpo: null,
      existingReleaseBranches: [],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "58.0.0"},
      tracked: trackedOnMaster(),
    });
    assert.equal(created.action, "create-branch");
    assert.equal(created.releaseBranch, "release-58.0.0");
    assert.equal(created.npmTag, "latest");
  });

  it("creates release-58.0.0 for the first 58 beta", (): void => {
    const created = decideProbe({
      branchTrackedExpo: null,
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
      branchTrackedExpo: "58.0.0-preview.1",
      existingReleaseBranches: ["release-58.0.0"],
      masterCatalogExpo: "57.0.14",
      npmTags: {latest: "57.0.14", next: "58.0.0-preview.2"},
      tracked: {
        ...trackedOnMaster(),
        expoVersion: "58.0.0-preview.1",
        npmTag: "next",
        releaseBranch: "release-58.0.0",
        sdkLine: "58.0.0",
      },
    });
    assert.equal(continued.action, "continue-branch");
    assert.equal(continued.expoVersion, "58.0.0-preview.2");
    assert.equal(maxExpoVersion(["58.0.0-preview.1", "57.0.14"]), "58.0.0-preview.1");
  });
});
