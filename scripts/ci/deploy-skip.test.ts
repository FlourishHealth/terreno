import {describe, it} from "bun:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {join} from "node:path";

const netlifyScript = join(import.meta.dir, "netlify-deploy.sh");
const gcpScript = join(import.meta.dir, "gcp-deploy.sh");

const run = ({
  script,
  args,
  env,
}: {
  script: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}): {status: number | null; stdout: string; stderr: string} => {
  const result = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {...process.env, ...env},
  });
  return {status: result.status, stdout: result.stdout, stderr: result.stderr};
};

describe("deploy scripts skip when CircleCI contexts are empty", () => {
  it("exits 0 from netlify-deploy.sh without compiling when auth or site id is missing", () => {
    const result = run({
      script: netlifyScript,
      args: ["docs", "preview", "pr-1225"],
      env: {
        NETLIFY_AUTH_TOKEN: "",
        NETLIFY_DOCS_SITE_ID: "",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Skipping Netlify docs preview deploy/);
    assert.doesNotMatch(result.stdout, /docusaurus/);
  });

  it("exits 0 from gcp-deploy.sh without authenticating when WIF or SA emails are missing", () => {
    const result = run({
      script: gcpScript,
      args: ["backend-preview"],
      env: {
        GCP_WIF_PROVIDER_PROD: "",
        GCP_TF_ADMIN_SA_PROD: "",
        GCP_CD_DEPLOYER_SA_PROD: "",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Skipping GCP backend-preview/);
  });
});
