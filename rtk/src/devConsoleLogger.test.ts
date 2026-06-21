import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {
  installTerrenoDevConsoleLogger,
  resetTerrenoDevConsoleLoggerForTests,
} from "./devConsoleLogger";

describe("installTerrenoDevConsoleLogger", () => {
  const prevFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.TERRENO_DEV_CONSOLE_LOGGER_TEST = "true";
    resetTerrenoDevConsoleLoggerForTests();
  });

  afterEach(() => {
    resetTerrenoDevConsoleLoggerForTests();
    delete process.env.TERRENO_DEV_CONSOLE_LOGGER_TEST;
    globalThis.fetch = prevFetch;
  });

  it("installs only once per process flag", () => {
    installTerrenoDevConsoleLogger();
    installTerrenoDevConsoleLogger();
    const g = globalThis as typeof globalThis & {__TERRENO_CONSOLE_LOGGER__?: boolean};
    expect(g.__TERRENO_CONSOLE_LOGGER__).toBe(true);
  });

  it("POSTs a single batched payload after debounce with expected shape", async () => {
    const fetchMock = mock((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(null, {status: 204}))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    installTerrenoDevConsoleLogger();
    console.error("one");
    console.warn("two");
    await new Promise<void>((r) => {
      setTimeout(r, 450);
    });

    expect(fetchMock.mock.calls.length).toBe(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as {
      entries: Array<{level: string; message: string}>;
    };
    expect(body.entries.map((e) => e.message)).toEqual(["one", "two"]);
    expect(body.entries[0]?.level).toBe("error");
    expect(body.entries[1]?.level).toBe("warn");
  });
});
