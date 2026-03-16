import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {ConsentForm} from "./models/consentForm";
import type {ConsentFormDefinition} from "./syncConsents";
import {syncConsents} from "./syncConsents";
import {setupDb} from "./tests";

const baseDef: ConsentFormDefinition = {
  content: {en: "# Terms\nPlease agree."},
  order: 1,
  required: true,
  title: "Terms of Service",
  type: "terms",
};

describe("syncConsents", () => {
  beforeEach(async () => {
    await setupDb();
    await ConsentForm.deleteMany({});
  });

  afterEach(async () => {
    await ConsentForm.deleteMany({});
  });

  it("creates a new consent form when none exists", async () => {
    const result = await syncConsents({terms: baseDef});

    expect(result.created).toEqual(["terms"]);
    expect(result.updated).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);

    const forms = await ConsentForm.find({slug: "terms"});
    expect(forms).toHaveLength(1);
    expect(forms[0].active).toBe(true);
    expect(forms[0].version).toBe(1);
    expect(forms[0].title).toBe("Terms of Service");
  });

  it("leaves unchanged forms alone", async () => {
    await syncConsents({terms: baseDef});
    const result = await syncConsents({terms: baseDef});

    expect(result.unchanged).toEqual(["terms"]);
    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(0);

    const forms = await ConsentForm.find({slug: "terms"});
    expect(forms).toHaveLength(1);
    expect(forms[0].version).toBe(1);
  });

  it("publishes a new version when content changes", async () => {
    await syncConsents({terms: baseDef});

    const updated = {...baseDef, content: {en: "# Updated Terms\nNew content."}};
    const result = await syncConsents({terms: updated});

    expect(result.updated).toEqual(["terms"]);

    const forms = await ConsentForm.find({slug: "terms"}).sort({version: 1});
    expect(forms).toHaveLength(2);
    expect(forms[0].active).toBe(false);
    expect(forms[0].version).toBe(1);
    expect(forms[1].active).toBe(true);
    expect(forms[1].version).toBe(2);
  });

  it("publishes a new version when title changes", async () => {
    await syncConsents({terms: baseDef});

    const updated = {...baseDef, title: "Updated Terms"};
    const result = await syncConsents({terms: updated});

    expect(result.updated).toEqual(["terms"]);

    const active = await ConsentForm.findOne({slug: "terms", active: true});
    expect(active?.version).toBe(2);
    expect(active?.title).toBe("Updated Terms");
  });

  it("deactivates removed forms when deactivateRemoved is true", async () => {
    await syncConsents({terms: baseDef, privacy: {...baseDef, type: "privacy", title: "Privacy"}});

    const result = await syncConsents({terms: baseDef}, {deactivateRemoved: true});

    expect(result.deactivated).toEqual(["privacy"]);
    expect(result.unchanged).toEqual(["terms"]);

    const privacy = await ConsentForm.findOne({slug: "privacy"});
    expect(privacy?.active).toBe(false);
  });

  it("does not deactivate removed forms by default", async () => {
    await syncConsents({terms: baseDef, privacy: {...baseDef, type: "privacy", title: "Privacy"}});

    const result = await syncConsents({terms: baseDef});

    expect(result.deactivated).toHaveLength(0);
    const privacy = await ConsentForm.findOne({slug: "privacy"});
    expect(privacy?.active).toBe(true);
  });

  it("does not write to the database in dry run mode", async () => {
    const result = await syncConsents({terms: baseDef}, {dryRun: true});

    expect(result.created).toEqual(["terms"]);
    const forms = await ConsentForm.find({slug: "terms"});
    expect(forms).toHaveLength(0);
  });

  it("handles multiple forms in a single sync", async () => {
    const result = await syncConsents({
      privacy: {...baseDef, order: 2, title: "Privacy Policy", type: "privacy"},
      terms: baseDef,
    });

    expect(result.created.sort()).toEqual(["privacy", "terms"]);

    const forms = await ConsentForm.find({}).sort({order: 1});
    expect(forms).toHaveLength(2);
    expect(forms[0].slug).toBe("terms");
    expect(forms[1].slug).toBe("privacy");
  });
});
