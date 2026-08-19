/**
 * `@terreno/syncdb/testing` — test-only helpers.
 *
 * Doubles and harness utilities live here rather than on the main entry so a
 * production bundle never reaches them and they carry no API-stability promise
 * beyond "useful in tests". Import them explicitly:
 *
 * ```ts
 * import {createFakeTransport} from "@terreno/syncdb/testing";
 * ```
 */

export {
  createFakeTransport,
  type FakeBatchResponder,
  type FakeMutationResponder,
  type FakeTransport,
} from "./fakeTransport";
