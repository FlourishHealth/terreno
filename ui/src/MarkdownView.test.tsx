import {describe, expect, it} from "bun:test";

import {MarkdownView} from "./MarkdownView";
import {renderWithTheme} from "./test-utils";

describe("MarkdownView", () => {
  it("renders correctly with simple text", () => {
    const {toJSON} = renderWithTheme(<MarkdownView>Hello world</MarkdownView>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders markdown headings", () => {
    const {toJSON} = renderWithTheme(
      <MarkdownView>{"# Heading 1\n## Heading 2\n### Heading 3"}</MarkdownView>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders markdown bold and italic", () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"**bold** and *italic* text"}</MarkdownView>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders markdown lists", () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"- Item 1\n- Item 2\n- Item 3"}</MarkdownView>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with inverted colors", () => {
    const {toJSON} = renderWithTheme(<MarkdownView inverted>Inverted text colors</MarkdownView>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders numbered lists", () => {
    const {toJSON} = renderWithTheme(
      <MarkdownView>{"1. First\n2. Second\n3. Third"}</MarkdownView>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders code blocks", () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"```\ncode block\n```"}</MarkdownView>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders inline code", () => {
    const {toJSON} = renderWithTheme(<MarkdownView>{"Use `inline code` here"}</MarkdownView>);
    expect(toJSON()).toMatchSnapshot();
  });
});
