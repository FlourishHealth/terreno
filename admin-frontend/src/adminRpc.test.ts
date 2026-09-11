import {describe, it} from "bun:test";
import {assert} from "chai";

import {asJsonBody, withQueryString} from "./adminRpc";

describe("withQueryString", () => {
  it("omits empty params and stringifies the rest", () => {
    assert.strictEqual(withQueryString({url: "/comms/messages"}), "/comms/messages");
    assert.strictEqual(
      withQueryString({params: {limit: 20, page: 1, q: ""}, url: "/comms/messages"}),
      "/comms/messages?limit=20&page=1"
    );
  });

  it("asJsonBody preserves JSON objects for adminRequest", () => {
    assert.deepEqual(asJsonBody({kind: "bulk-patch"}), {kind: "bulk-patch"});
  });
});
