import {describe, expect, it, mock} from "bun:test";
import {Platform} from "react-native";

import {MarkdownEmbed} from "./MarkdownEmbed";
import {renderWithTheme} from "./test-utils";

mock.module("react-native-webview", () => ({
  default: () => null,
}));

describe("MarkdownEmbed", () => {
  const originalOS = Platform.OS;

  it("returns null for non-embeddable URLs", () => {
    const result = renderWithTheme(<MarkdownEmbed url="https://example.com/docs" />);
    expect(result.toJSON()).toBeNull();
  });

  it("renders the web iframe on web", () => {
    Platform.OS = "web";
    const result = renderWithTheme(
      <MarkdownEmbed url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
    );
    expect(result.getByTestId("markdown-embed-web")).toBeTruthy();
    Platform.OS = originalOS;
  });

  it("renders the native webview on ios", () => {
    Platform.OS = "ios";
    const result = renderWithTheme(<MarkdownEmbed url="https://www.loom.com/share/abc123def456" />);
    expect(result.getByTestId("markdown-embed-native")).toBeTruthy();
    Platform.OS = originalOS;
  });
});
