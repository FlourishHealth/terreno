import {describe, expect, it} from "bun:test";

import {
  AIRequestExplorer,
  Button,
  ConsentNavigator,
  DraggableList,
  EmojiSelector,
  GPTChat,
  MarkdownEditor,
} from "@terreno/ui";
import {Box} from "@terreno/ui/Box";
import EmojiSelectorSubpath from "@terreno/ui/EmojiSelector";
import {GPTChat as GPTChatSubpath} from "@terreno/ui/GPTChat";
import {MarkdownView} from "@terreno/ui/MarkdownView";

const ROOT_IMPORT_PATHS = [
  "@terreno/ui",
  "@terreno/ui/Button",
  "@terreno/ui/Box",
  "@terreno/ui/dist/Button.js",
  "@terreno/ui/src/Button.tsx",
  "@terreno/ui/GPTChat",
  "@terreno/ui/EmojiSelector",
  "@terreno/ui/MarkdownView",
];

describe("root import compatibility", () => {
  it("keeps root Button export available", () => {
    expect(Button).toBeTruthy();
  });

  it("resolves public subpath imports", () => {
    expect(Box).toBeTruthy();
    expect(GPTChatSubpath).toBeTruthy();
    expect(EmojiSelectorSubpath).toBeTruthy();
    expect(MarkdownView).toBeTruthy();
  });

  it("exposes lazy root exports for measured heavy optional widgets", () => {
    expect(AIRequestExplorer).toBeTruthy();
    expect(ConsentNavigator).toBeTruthy();
    expect(DraggableList).toBeTruthy();
    expect(EmojiSelector).toBeTruthy();
    expect(GPTChat).toBeTruthy();
    expect(MarkdownEditor).toBeTruthy();
  });

  it("resolves documented package entrypoints", async () => {
    for (const importPath of ROOT_IMPORT_PATHS) {
      const moduleNamespace = await import(importPath);
      expect(Object.keys(moduleNamespace).length).toBeGreaterThan(0);
    }
  });
});
