import {describe, it} from "bun:test";
import {assert} from "chai";
import {bridgeBetterAuthReactClient} from "./betterAuthReactClient";

const sessionResult = {data: {session: {token: "token-1"}, user: {id: "user-1"}}};

describe("bridgeBetterAuthReactClient", () => {
  it("exposes the session atom as a subscribe surface", async () => {
    const listeners: Array<(value: unknown) => void> = [];
    let unsubscribed = false;
    const reactClient = {
      $store: {
        atoms: {
          session: {
            subscribe: (listener: (value: unknown) => void): (() => void) => {
              listeners.push(listener);
              return (): void => {
                unsubscribed = true;
              };
            },
          },
        },
      },
      getSession: async () => sessionResult,
    };

    const bridged = bridgeBetterAuthReactClient(reactClient);

    assert.deepEqual(await bridged.getSession(), sessionResult);
    assert.isFunction(bridged.useSession?.subscribe);

    const received: unknown[] = [];
    const unsubscribe = bridged.useSession?.subscribe?.((value) => {
      received.push(value);
    });
    assert.equal(listeners.length, 1);
    listeners[0]?.(sessionResult);
    assert.deepEqual(received, [sessionResult]);

    unsubscribe?.();
    assert.isTrue(unsubscribed);
  });

  it("omits useSession when the client exposes no session atom", async () => {
    const bridged = bridgeBetterAuthReactClient({getSession: async () => sessionResult});

    assert.isUndefined(bridged.useSession);
    assert.deepEqual(await bridged.getSession(), sessionResult);
  });
});
