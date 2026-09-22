import {afterEach, describe, it} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {assert} from "chai";

const repoRoot = join(import.meta.dir, "../..");
const waitScript = join(import.meta.dir, "wait-cloud-run-health.sh");
const deployScript = readFileSync(join(import.meta.dir, "gcp-deploy.sh"), "utf8");
const cdWorkflow = readFileSync(join(repoRoot, ".github/workflows/cd.yml"), "utf8");
const frontendDeployWorkflow = readFileSync(
  join(repoRoot, ".github/workflows/frontend-example-deploy.yml"),
  "utf8"
);
const FRONTEND_PREVIEW_PATHS = [
  "example-frontend/**",
  "ui/**",
  "rtk/**",
  "admin-frontend/**",
  "bun.lock",
  ".github/workflows/frontend-example-deploy.yml",
];

interface WaitResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const servers: Bun.Server<unknown>[] = [];

const runWait = async ({
  handler,
  timeoutSeconds = 3,
}: {
  handler: (request: Request) => Response;
  timeoutSeconds?: number;
}): Promise<WaitResult> => {
  const server = Bun.serve({fetch: handler, port: 0});
  servers.push(server);
  const process = Bun.spawn(
    ["bash", waitScript, `http://127.0.0.1:${server.port}`, `${timeoutSeconds}`],
    {
      env: {...Bun.env, WAIT_INTERVAL_SECONDS: "0.05"},
      stderr: "pipe",
      stdout: "pipe",
    }
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return {exitCode, stderr, stdout};
};

afterEach((): void => {
  for (const server of servers.splice(0)) {
    server.stop(true);
  }
});

describe("Cloud Run preview readiness", (): void => {
  it("waits through the early-listen 503 until health is ready", async (): Promise<void> => {
    let requestCount = 0;
    const result = await runWait({
      handler: (): Response => {
        requestCount += 1;
        if (requestCount < 3) {
          return Response.json({details: {status: "starting"}, healthy: false}, {status: 503});
        }
        return Response.json({healthy: true});
      },
    });

    assert.equal(result.exitCode, 0, result.stderr);
    assert.isAtLeast(requestCount, 3);
    assert.include(result.stdout, "Cloud Run preview is healthy");
  });

  it("fails when the preview never becomes healthy", async (): Promise<void> => {
    const result = await runWait({
      handler: (): Response =>
        Response.json({details: {status: "starting"}, healthy: false}, {status: 503}),
      timeoutSeconds: 1,
    });

    assert.notEqual(result.exitCode, 0);
    assert.include(result.stderr, "Timed out waiting for Cloud Run preview health");
    assert.include(result.stderr, '"status":"starting"');
  });

  it("keeps CPU allocated and gates both preview deployment paths", (): void => {
    const previewJob = cdWorkflow.slice(
      cdWorkflow.indexOf("  backend-deploy-preview:"),
      cdWorkflow.indexOf("  # ───────────────────────────── Backend tasks worker")
    );

    assert.include(previewJob, "--no-cpu-throttling");
    assert.include(previewJob, "scripts/ci/wait-cloud-run-health.sh");
    assert.isBelow(
      previewJob.indexOf("scripts/ci/wait-cloud-run-health.sh"),
      previewJob.indexOf("Set deployment status to success")
    );
    assert.match(
      deployScript,
      /if \[ "\$tag" = "prod" \]; then[\s\S]*else[\s\S]*--no-cpu-throttling/
    );
    assert.match(
      deployScript,
      /if \[\[ "\$tag" == pr-\* \]\]; then[\s\S]*wait-cloud-run-health\.sh/
    );
  });

  it("deploys an isolated backend for every frontend PR preview", (): void => {
    const pullRequestPaths = cdWorkflow.slice(
      cdWorkflow.indexOf("  pull_request:"),
      cdWorkflow.indexOf("  workflow_dispatch:")
    );
    const backendPaths = cdWorkflow.slice(
      cdWorkflow.indexOf("            backend:"),
      cdWorkflow.indexOf("            tasks:")
    );

    for (const path of FRONTEND_PREVIEW_PATHS) {
      assert.include(pullRequestPaths, path);
      assert.include(backendPaths, path);
    }

    assert.match(
      frontendDeployWorkflow,
      /URL="https:\/\/pr-\$\{\{ github\.event\.pull_request\.number \}\}---terreno-backend-example-7knxlrnpqq-uc\.a\.run\.app"/
    );
    assert.notInclude(frontendDeployWorkflow, "HAS_BACKEND_CHANGES");
  });
});
