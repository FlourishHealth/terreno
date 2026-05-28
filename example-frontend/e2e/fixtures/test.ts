import {test as baseTest, expect} from "@playwright/test";
import {GLOBAL_CONSOLE_ALLOWLIST} from "./consoleAllowlist";

interface CapturedMessage {
  type: "console.warn" | "console.error" | "pageerror";
  text: string;
  location?: string;
}

export interface ConsoleGuard {
  // Allow messages matching the given pattern in the current test only.
  // Substring match for strings, .test() for regexes.
  allow: (pattern: string | RegExp) => void;
  // Read-only view of currently-captured (not-yet-allowed) messages.
  messages: () => ReadonlyArray<CapturedMessage>;
}

interface ConsoleGuardFixtures {
  consoleGuard: ConsoleGuard;
}

const matchesAny = (text: string, patterns: ReadonlyArray<string | RegExp>): boolean => {
  for (const pattern of patterns) {
    if (typeof pattern === "string") {
      if (text.includes(pattern)) {
        return true;
      }
    } else if (pattern.test(text)) {
      return true;
    }
  }
  return false;
};

const formatMessages = (messages: ReadonlyArray<CapturedMessage>): string => {
  return messages
    .map((m, i) => {
      const loc = m.location ? ` (${m.location})` : "";
      return `  ${i + 1}. [${m.type}]${loc} ${m.text}`;
    })
    .join("\n");
};

export const test = baseTest.extend<ConsoleGuardFixtures>({
  consoleGuard: [
    async ({page}, use, testInfo) => {
      const captured: CapturedMessage[] = [];
      const localAllowlist: Array<string | RegExp> = [];

      const guard: ConsoleGuard = {
        allow: (pattern) => {
          localAllowlist.push(pattern);
        },
        messages: () => captured.slice(),
      };

      const isAllowed = (text: string): boolean => {
        return matchesAny(text, GLOBAL_CONSOLE_ALLOWLIST) || matchesAny(text, localAllowlist);
      };

      page.on("console", (msg) => {
        const type = msg.type();
        if (type !== "warning" && type !== "error") {
          return;
        }
        const text = msg.text();
        const location = msg.location();
        const locationString = location.url
          ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
          : undefined;
        captured.push({
          location: locationString,
          text,
          type: type === "warning" ? "console.warn" : "console.error",
        });
      });

      page.on("pageerror", (error) => {
        const parts = [error.name, error.message, error.stack].filter((s): s is string =>
          Boolean(s)
        );
        const text = parts.length > 0 ? parts.join(" — ") : String(error);
        captured.push({text, type: "pageerror"});
      });

      await use(guard);

      const unexpected = captured.filter((m) => !isAllowed(m.text));
      if (unexpected.length === 0) {
        return;
      }

      const summary = formatMessages(unexpected);
      await testInfo.attach("unexpected-console-output.txt", {
        body: summary,
        contentType: "text/plain",
      });
      throw new Error(
        `Unexpected console output during test (${unexpected.length} message(s)):\n${summary}\n\n` +
          `If these are expected, allow them per-test via consoleGuard.allow("pattern") ` +
          `or add to e2e/fixtures/consoleAllowlist.ts.`
      );
    },
    {auto: true},
  ],
});

// Re-export expect so consumers can import both from one place.
export {expect};
