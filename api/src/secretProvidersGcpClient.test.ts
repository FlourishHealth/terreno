import {beforeEach, describe, expect, it, mock} from "bun:test";

import {GcpSecretProvider} from "./secretProviders";

// Exercises GcpSecretProvider.getClient(), which dynamically imports the
// optional @google-cloud/secret-manager peer dependency. `mock.module` is
// hoisted to the top of the file and the registration lives for the rest of the
// process, so these tests live in their own file: secretProviders.test.ts
// asserts the behavior when the real (uninstalled) module fails to import, and
// runs before this file.
let clientsConstructed = 0;
const requestedNames: string[] = [];
let payload: string | Uint8Array = "from-gcp";

class FakeSecretManagerServiceClient {
  constructor() {
    clientsConstructed++;
  }

  async accessSecretVersion(request: {
    name: string;
  }): Promise<[{payload: {data: string | Uint8Array}}]> {
    requestedNames.push(request.name);
    return [{payload: {data: payload}}];
  }
}

mock.module("@google-cloud/secret-manager", () => ({
  SecretManagerServiceClient: FakeSecretManagerServiceClient,
}));

describe("GcpSecretProvider client construction", () => {
  beforeEach(() => {
    clientsConstructed = 0;
    requestedNames.length = 0;
    payload = "from-gcp";
  });

  it("constructs the client from the imported module and caches it", async () => {
    const provider = new GcpSecretProvider({projectId: "my-project"});

    expect(await provider.getSecret("openai-api-key")).toBe("from-gcp");
    expect(await provider.getSecret("openai-api-key", "3")).toBe("from-gcp");

    expect(clientsConstructed).toBe(1);
    expect(requestedNames).toEqual([
      "projects/my-project/secrets/openai-api-key/versions/latest",
      "projects/my-project/secrets/openai-api-key/versions/3",
    ]);
  });

  it("decodes binary payloads", async () => {
    payload = new TextEncoder().encode("binary-secret");
    const provider = new GcpSecretProvider({projectId: "my-project"});

    expect(await provider.getSecret("openai-api-key")).toBe("binary-secret");
  });

  it("honors a full resource path without appending a version twice", async () => {
    const provider = new GcpSecretProvider({projectId: "my-project"});

    await provider.getSecret("projects/other/secrets/key/versions/7");

    expect(requestedNames).toEqual(["projects/other/secrets/key/versions/7"]);
  });
});
