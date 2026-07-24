/**
 * Isolated tests for constants.ts paths that require mock.module.
 *
 * The module is loaded in a subprocess so mock.module does not replace
 * expo-constants for the rest of the package test process.
 */
import {describe, it} from "bun:test";
import {assert} from "chai";

interface ConstantsModuleResult {
  authDebug: boolean;
  debugCalls: unknown[][];
  errorCalls: unknown[][];
  infoCalls: unknown[][];
}

const runConstantsModule = async (
  expoConstants: Record<string, unknown>
): Promise<ConstantsModuleResult> => {
  const constantsUrl = new URL("../constants.ts", import.meta.url).href;
  const script = `
    import {mock} from "bun:test";
    const output = console.log.bind(console);
    const debugCalls = [];
    const errorCalls = [];
    const infoCalls = [];
    console.debug = (...args) => debugCalls.push(args);
    console.error = (...args) => errorCalls.push(args);
    console.info = (...args) => infoCalls.push(args);
    mock.module("expo-constants", () => ({default: ${JSON.stringify(expoConstants)}}));
    const loaded = await import(${JSON.stringify(constantsUrl)});
    loaded.logAuth("hello");
    loaded.logSocket(undefined, "ws on");
    output(JSON.stringify({
      authDebug: loaded.AUTH_DEBUG,
      debugCalls,
      errorCalls,
      infoCalls,
    }));
  `;
  const child = Bun.spawn([process.execPath, "-e", script], {
    cwd: import.meta.dir,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  assert.equal(exitCode, 0, stderr);
  return JSON.parse(stdout.trim()) as ConstantsModuleResult;
};

describe("expo tunnel warning", () => {
  it("warns when expoGoConfig.debuggerHost contains exp.direct", async () => {
    const result = await runConstantsModule({
      expoConfig: {extra: {}},
      expoGoConfig: {debuggerHost: "abc.exp.direct"},
    });

    assert.isTrue(
      result.errorCalls.some((args) =>
        args.some((value) => String(value).includes("Expo Tunnel is not currently"))
      )
    );
  });
});

describe("AUTH_DEBUG enabled path", () => {
  it("logs auth and websocket debug messages when enabled", async () => {
    const result = await runConstantsModule({
      expoConfig: {extra: {AUTH_DEBUG: "true", WEBSOCKETS_DEBUG: "true"}},
    });

    assert.isTrue(result.authDebug);
    assert.isTrue(
      result.debugCalls.some((args) =>
        args.some((value) => String(value).includes("AUTH_DEBUG is enabled"))
      )
    );
    assert.isTrue(
      result.debugCalls.some((args) =>
        args.some((value) => String(value).includes("WEBSOCKETS_DEBUG is enabled"))
      )
    );
    assert.isTrue(
      result.debugCalls.some((args) => args.some((value) => String(value).includes("hello")))
    );
    assert.isTrue(
      result.infoCalls.some((args) => args[0] === "[websocket]" && args[1] === "ws on")
    );
  });
});
