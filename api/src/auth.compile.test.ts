import {afterAll, beforeAll, describe, expect, it} from "bun:test";
import {mkdtemp, rm} from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/**
 * Regression test: auth failures must stay 401s inside `bun build --compile`
 * binaries.
 *
 * passport's internal AuthenticationError calls `Error.captureStackTrace(this,
 * arguments.callee)`. Bundling into a single-file executable puts that CJS
 * code in strict-mode context, where touching `arguments.callee` throws a
 * TypeError — so with `failWithError: true`, every unauthenticated request
 * used to 500 instead of 401 (while behaving fine under plain `bun run`).
 * authenticateMiddleware therefore must never route failures through
 * passport's error class.
 *
 * This compiles a real fixture server (src/tests/fixtures/compileAuthEntry.ts)
 * and asserts the 401 contract against the running binary.
 */

/** Grab an OS-assigned free port, then release it for the fixture binary. */
const findFreePort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a port"));
        return;
      }
      const {port} = address;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
};

describe("authenticateMiddleware inside a bun-compiled binary", () => {
  let tmpDir: string;
  let child: ReturnType<typeof Bun.spawn> | null = null;
  let baseUrl: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "terreno-compile-auth-"));
    const binaryPath = path.join(tmpDir, "compile-auth-server");
    const entryPath = path.join(__dirname, "tests/fixtures/compileAuthEntry.ts");

    const build = Bun.spawn(["bun", "build", "--compile", entryPath, "--outfile", binaryPath], {
      cwd: __dirname,
      stderr: "pipe",
      stdout: "pipe",
    });
    const buildExit = await build.exited;
    if (buildExit !== 0) {
      throw new Error(`bun build --compile failed: ${await new Response(build.stderr).text()}`);
    }

    const port = await findFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = Bun.spawn([binaryPath], {
      env: {...process.env, PORT: String(port)},
      stderr: "inherit",
      stdout: "inherit",
    });

    // Poll until the fixture server answers (or its process dies).
    const deadline = Date.now() + 15000;
    for (;;) {
      try {
        await fetch(`${baseUrl}/secure`);
        break;
      } catch {
        if (child.exitCode !== null) {
          throw new Error(`fixture server exited with code ${child.exitCode}`);
        }
        if (Date.now() > deadline) {
          throw new Error("fixture server never became reachable");
        }
        await Bun.sleep(100);
      }
    }
  }, 120000);

  afterAll(async () => {
    child?.kill();
    await child?.exited;
    await rm(tmpDir, {force: true, recursive: true});
  });

  it("returns 401 (not 500) for a request with no token", async () => {
    const res = await fetch(`${baseUrl}/secure`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({status: 401, title: "Unauthorized"});
  });

  it("returns 401 (not 500) for a request with an invalid token", async () => {
    const res = await fetch(`${baseUrl}/secure`, {
      headers: {Authorization: "Bearer not-a-real-jwt"},
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({status: 401, title: "Unauthorized"});
  });
});
