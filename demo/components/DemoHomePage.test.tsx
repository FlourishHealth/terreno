import {describe, it} from "bun:test";
import {assert} from "chai";

import {renderWithTheme} from "../../ui/src/test-utils";
import {DemoHomePage} from "./DemoHomePage";
import {DemoHomeBanner} from "./demoHomeBanner";

const DEMO_BANNER_WIDTH = 616;
const DEMO_BANNER_HEIGHT = 280;

interface RenderedNode {
  props?: Record<string, unknown>;
  children?: (RenderedNode | string)[] | null;
}

const collectTestIds = (node: RenderedNode | string | null): string[] => {
  if (!node || typeof node === "string") {
    return [];
  }
  const testId = node.props?.testID;
  const own = typeof testId === "string" ? [testId] : [];
  const children = node.children ?? [];
  return children.reduce<string[]>((ids, child) => ids.concat(collectTestIds(child)), own);
};

describe("DemoHomeBanner", () => {
  it("spans two demo card slots", () => {
    const {getByTestId} = renderWithTheme(<DemoHomeBanner />);
    const banner = getByTestId("demo-home-banner");

    assert.equal(banner.props.style.width, DEMO_BANNER_WIDTH);
    assert.equal(banner.props.style.height, DEMO_BANNER_HEIGHT);
  });

  it("flows inline with the component cards instead of above them", () => {
    const rendered = renderWithTheme(<DemoHomePage onPress={() => {}} />);
    const testIds = collectTestIds(rendered.toJSON() as RenderedNode | null);
    const calloutIndex = testIds.indexOf("demo-home-palette-callout");
    const bannerIndex = testIds.indexOf("demo-home-banner");
    const firstCardIndex = testIds.findIndex((id) => id.startsWith("demo-home-accordion"));

    assert.isAbove(calloutIndex, -1, "palette callout is rendered");
    assert.isAbove(bannerIndex, calloutIndex, "banner sits below the palette callout");
    assert.equal(firstCardIndex, bannerIndex + 1, "banner takes the first card slots");
  });
});
