# Mocking at boundaries

Mock only a boundary where production leaves the system:

- third-party APIs and provider SDKs
- time, randomness, or operating-system I/O
- network transport
- file storage when a real temporary directory is unsuitable

Use the real database through `@terreno/test`. Use real Terreno models, stores, reducers, routers, and internal collaborators.

## Prefer injected fakes

Pass a narrow, domain-specific adapter into production code and provide a local fake in the test. Each adapter operation should have one typed purpose and one response shape.

Good Terreno examples:

- `comms/src/commsService.test.ts` injects local `MailProvider`, `SmsProvider`, `PushProvider`, and `VerificationProvider` fakes while retaining the real service and MongoDB.
- `syncdb/src/client.test.ts` injects `createFakeTransport`, an HTTP channel, auth provider, persister, and clock through the public client configuration.

Keep fake state inside the test or a fresh harness factory. Assert observable results first; inspect fake state only when the boundary interaction itself is the contract.

## Module mocks leak

Bun module mocks are process-wide and hoisted. Registration survives beyond the individual test and can contaminate later files or make test order significant.

Design an injectable seam instead of using `mock.module`. When an unchangeable dynamic import makes a module mock unavoidable:

1. isolate it in a dedicated `*.isolated.ts` or dedicated test process
2. document why dependency injection cannot represent the boundary
3. run it through the package's isolated-test script
4. never rely on restoring the module in `afterEach`

`api/src/secretProvidersGcpClient.test.ts` documents this exceptional isolation pattern. It is a containment example, not the default.

## Scoped spies

A test-local `spyOn` is acceptable for a true boundary or for forcing an otherwise unreachable framework error. Restore it in the same test lifecycle. A spy on an internal collaborator is not a substitute for testing public behavior.
