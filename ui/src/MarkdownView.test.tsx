import {describe, expect, it} from "bun:test";
import assert from "node:assert";
import {waitFor} from "@testing-library/react-native";

import {MarkdownView} from "./MarkdownView";
import {renderWithTheme} from "./test-utils";

describe("MarkdownView", () => {
  it("renders correctly with simple text", async () => {
    const {toJSON} = renderWithTheme(<MarkdownView>Hello world</MarkdownView>);
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("Hello world");
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders markdown headings", async () => {
    const {toJSON} = renderWithTheme(
      <MarkdownView>{"# Heading 1\n## Heading 2\n### Heading 3"}</MarkdownView>
    );
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("Heading 1");
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders markdown bold and italic", async () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"**bold** and *italic* text"}</MarkdownView>);
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("bold");
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders markdown lists", async () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"- Item 1\n- Item 2\n- Item 3"}</MarkdownView>);
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("Item 1");
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with inverted colors", async () => {
    const {toJSON} = renderWithTheme(<MarkdownView inverted>Inverted text colors</MarkdownView>);
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("Inverted text colors");
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders numbered lists", async () => {
    const {toJSON} = renderWithTheme(
      <MarkdownView>{"1. First\n2. Second\n3. Third"}</MarkdownView>
    );
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("First");
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it("keeps long consent ordered list markers on one line", async () => {
    const longConsentList = Array.from({length: 17}, (_, index) => {
      return `${index + 1}. This consent item has enough text to wrap on narrow mobile screens.`;
    }).join("\n");
    const {toJSON} = renderWithTheme(<MarkdownView>{longConsentList}</MarkdownView>);
    await waitFor(() => {
      const serialized = JSON.stringify(toJSON());
      expect(serialized).toContain("17");
    });
    const serialized = JSON.stringify(toJSON());

    assert.ok(serialized.includes('"minWidth":32'));
    assert.ok(serialized.includes('"flexShrink":0'));
    assert.ok(serialized.includes('"textAlign":"right"'));
    assert.ok(serialized.includes("17"));
  });

  it("uses explicit markdown paragraph line height for wrapped mobile text", async () => {
    const {toJSON} = renderWithTheme(
      <MarkdownView>
        {
          "This consent paragraph is intentionally long so it wraps across multiple lines on Android and keeps its measured height."
        }
      </MarkdownView>
    );
    await waitFor(() => {
      const serialized = JSON.stringify(toJSON());
      expect(serialized).toContain('"fontSize":14');
    });
    const serialized = JSON.stringify(toJSON());

    assert.ok(serialized.includes('"fontSize":14'));
    assert.ok(serialized.includes('"lineHeight":20'));
  });

  it("renders code blocks", async () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"```\ncode block\n```"}</MarkdownView>);
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("code block");
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders inline code", async () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"Use `inline code` here"}</MarkdownView>);
    await waitFor(() => {
      expect(JSON.stringify(toJSON())).toContain("inline code");
    });
    expect(toJSON()).toMatchSnapshot();
  });
});
