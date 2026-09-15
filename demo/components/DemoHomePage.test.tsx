import {describe, it} from "bun:test";
import {assert} from "chai";

import {renderWithTheme} from "../../ui/src/test-utils";
import {DEMO_BANNER_HEIGHT, DEMO_BANNER_WIDTH, DemoHomeBanner} from "./DemoHomePage";

describe("DemoHomeBanner", () => {
  it("spans two demo card slots", () => {
    const {getByTestId} = renderWithTheme(<DemoHomeBanner />);
    const banner = getByTestId("demo-home-banner");

    assert.equal(DEMO_BANNER_WIDTH, 616);
    assert.equal(DEMO_BANNER_HEIGHT, 280);
    assert.equal(banner.props.style.width, DEMO_BANNER_WIDTH);
    assert.equal(banner.props.style.height, DEMO_BANNER_HEIGHT);
  });
});
