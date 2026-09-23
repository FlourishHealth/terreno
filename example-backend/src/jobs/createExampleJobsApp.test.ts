import {describe, it} from "bun:test";
import {assert} from "chai";

import "../models/user";
import {createExampleJobsApp} from "./createExampleJobsApp";

const missingScriptPayload = {
  args: {},
  scriptName: "does-not-exist",
  taskId: "000000000000000000000000",
  wetRun: false,
};

describe("createExampleJobsApp", (): void => {
  it("registers example jobs and looks up admin scripts from the example catalog", async (): Promise<void> => {
    const jobsApp = createExampleJobsApp();
    const adminScript = jobsApp.getDefinition("admin/script");

    assert.isDefined(jobsApp.getDefinition("example/heartbeat"));
    assert.isDefined(adminScript);

    try {
      await adminScript?.handler(missingScriptPayload, {
        log: {
          debug: (): void => {},
          error: (): void => {},
          info: (): void => {},
          warn: (): void => {},
        },
        signal: new AbortController().signal,
      } as never);
      assert.fail("expected a missing admin script to throw");
    } catch (error: unknown) {
      assert.match(String(error), /Script not found: does-not-exist/);
    }
  });
});
