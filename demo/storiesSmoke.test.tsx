import {describe, expect, it} from "bun:test";
import type React from "react";
import {renderWithTheme} from "../ui/src/test-utils";

import {
  collectRegisteredStoryRenders,
  type RegisteredStoryRender,
} from "./collectRegisteredStoryRenders";
import {DemoConfig} from "./demoConfig";

const StoryHost: React.FC<{entry: RegisteredStoryRender}> = ({entry}) => {
  return <>{entry.render()}</>;
};

describe("registered demo stories", () => {
  const renders = collectRegisteredStoryRenders(DemoConfig);

  it("iterates DemoConfig instead of a hardcoded component list", () => {
    const expectedCount = DemoConfig.reduce((count, config) => {
      return count + 1 + Object.keys(config.stories).length;
    }, 0);
    expect(renders.length).toBe(expectedCount);
    expect(renders.length).toBeGreaterThan(50);
    expect(renders.some((entry) => entry.id.startsWith(`${DemoConfig[0]?.name} /`))).toBe(true);
  });

  for (const entry of renders) {
    it(`renders ${entry.id} without throwing`, () => {
      expect(() => {
        renderWithTheme(<StoryHost entry={entry} />);
      }).not.toThrow();
    });
  }
});
