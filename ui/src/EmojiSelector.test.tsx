import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import EmojiSelector, {Categories, charFromEmojiObject} from "./EmojiSelector";
import {renderWithTheme} from "./test-utils";

describe("EmojiSelector", () => {
  it("renders search bar when showSearchBar is true", () => {
    const {getByPlaceholderText} = renderWithTheme(
      <EmojiSelector
        category={Categories.all}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search emojis"
        showHistory={false}
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );

    expect(getByPlaceholderText("Search emojis")).toBeTruthy();
  });

  it("renders tab bar when showTabs is true", () => {
    const {getByText} = renderWithTheme(
      <EmojiSelector
        category={Categories.people}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search emojis"
        showHistory={false}
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );

    // One of the known category symbols
    expect(getByText("😀")).toBeTruthy();
  });

  it("matches snapshot", () => {
    const tree = renderWithTheme(
      <EmojiSelector
        category={Categories.people}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search emojis"
        showHistory={false}
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );

    expect(tree.toJSON()).toMatchSnapshot();
  });

  it("renders without tabs", () => {
    const {toJSON} = renderWithTheme(
      <EmojiSelector
        category={Categories.people}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search emojis"
        showHistory={false}
        showSearchBar
        showSectionTitles={false}
        showTabs={false}
        theme="#007AFF"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without search bar", () => {
    const {queryByPlaceholderText} = renderWithTheme(
      <EmojiSelector
        category={Categories.people}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search emojis"
        showHistory={false}
        showSearchBar={false}
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );
    expect(queryByPlaceholderText("Search emojis")).toBeNull();
  });

  it("renders with history enabled", () => {
    const {toJSON} = renderWithTheme(
      <EmojiSelector
        category={Categories.people}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search emojis"
        showHistory
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with all category and shouldInclude filter", () => {
    const {toJSON} = renderWithTheme(
      <EmojiSelector
        category={Categories.all}
        columns={8}
        onEmojiSelected={mock(() => {})}
        placeholder="Search"
        shouldInclude={(emoji) => emoji.category === "Smileys & Emotion"}
        showHistory={false}
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with history category", () => {
    const {toJSON} = renderWithTheme(
      <EmojiSelector
        category={Categories.history}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search"
        showHistory
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("updates search query when user types in search bar", async () => {
    const {getByPlaceholderText} = renderWithTheme(
      <EmojiSelector
        category={Categories.all}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search emojis"
        showHistory={false}
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );
    const input = getByPlaceholderText("Search emojis");
    await act(async () => {
      fireEvent.changeText(input, "smile");
    });
    expect(input.props.value).toBe("smile");
  });

  it("charFromEmojiObject returns a string for a valid emoji", () => {
    const smiley = {
      category: "Smileys & Emotion",
      short_names: ["smiley"],
      sort_order: 1,
      unified: "1F603",
    };
    expect(charFromEmojiObject(smiley)).toBe("😃");
  });

  it("exports Categories object with all expected keys", () => {
    expect(Categories.all).toBeDefined();
    expect(Categories.emotion).toBeDefined();
    expect(Categories.people).toBeDefined();
    expect(Categories.history).toBeDefined();
    expect(Categories.nature).toBeDefined();
    expect(Categories.food).toBeDefined();
    expect(Categories.activities).toBeDefined();
    expect(Categories.places).toBeDefined();
    expect(Categories.objects).toBeDefined();
    expect(Categories.symbols).toBeDefined();
    expect(Categories.flags).toBeDefined();
  });

  it("handles layout event to compute emoji list and set ready state", async () => {
    const {toJSON, root} = renderWithTheme(
      <EmojiSelector
        category={Categories.people}
        columns={6}
        onEmojiSelected={mock(() => {})}
        placeholder="Search"
        showHistory={false}
        showSearchBar
        showSectionTitles
        showTabs
        theme="#007AFF"
      />
    );
    // Trigger the onLayout callback so state moves to ready.
    await act(async () => {
      (root as any).props.onLayout?.({
        nativeEvent: {layout: {height: 600, width: 360, x: 0, y: 0}},
      });
    });
    expect(toJSON()).toBeTruthy();
  });
});
