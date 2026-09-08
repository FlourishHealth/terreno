import {describe, expect, it} from "bun:test";
import {
  isEmbeddableMediaUrl,
  isLoomUrl,
  isYouTubeUrl,
  toLoomEmbedUrl,
  toMediaEmbedUrl,
  toYouTubeEmbedUrl,
} from "./markdownEmbeds";

describe("markdownEmbeds", () => {
  it("detects YouTube URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://example.com")).toBe(false);
  });

  it("detects Loom URLs", () => {
    expect(isLoomUrl("https://www.loom.com/share/abc123def456")).toBe(true);
    expect(isLoomUrl("https://example.com")).toBe(false);
  });

  it("converts media URLs to embed URLs", () => {
    expect(toYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(toYouTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(toLoomEmbedUrl("https://www.loom.com/share/abc123def456")).toBe(
      "https://www.loom.com/embed/abc123def456"
    );
    expect(toMediaEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain("embed");
  });

  it("identifies embeddable media URLs", () => {
    expect(isEmbeddableMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isEmbeddableMediaUrl("https://www.loom.com/share/abc123def456")).toBe(true);
    expect(isEmbeddableMediaUrl("https://example.com/docs")).toBe(false);
  });
});
