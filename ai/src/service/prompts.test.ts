import {describe, expect, it} from "bun:test";

import {
  CONTENT_SUMMARY_PROMPT,
  DEFAULT_GPT_MEMORY,
  JSON_VALUE_SYSTEM_PROMPT,
  REMIX_PROMPT,
  TITLE_GENERATION_PROMPT,
  TRANSLATION_PROMPT,
} from "./prompts";

describe("AI prompt constants", () => {
  it("exports non-empty system and helper prompts", () => {
    expect(DEFAULT_GPT_MEMORY.length).toBeGreaterThan(20);
    expect(REMIX_PROMPT).toContain("Reword");
    expect(CONTENT_SUMMARY_PROMPT).toContain("two-paragraph");
    expect(TRANSLATION_PROMPT).toContain("{sourceLanguage}");
    expect(TRANSLATION_PROMPT).toContain("{targetLanguage}");
    expect(TITLE_GENERATION_PROMPT).toContain("3-6 words");
    expect(JSON_VALUE_SYSTEM_PROMPT).toContain("JSON value");
  });
});
