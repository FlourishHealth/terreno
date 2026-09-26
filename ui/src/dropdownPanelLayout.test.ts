import {describe, expect, it} from "bun:test";

import {
  computeDropdownPanelLayout,
  DROPDOWN_PANEL_MIN_HEIGHT,
  DROPDOWN_PANEL_SCREEN_MARGIN,
} from "./dropdownPanelLayout";

const viewport = {viewportHeight: 800, viewportWidth: 1200};

describe("computeDropdownPanelLayout", () => {
  it("left-aligns to the trigger when the panel fits", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 100, x: 100, y: 60},
      panelWidth: 320,
      ...viewport,
    });
    expect(layout.left).toBe(100);
    expect(layout.top).toBe(104);
    expect(layout.placement).toBe("below");
  });

  it("right-aligns to the trigger when a left-aligned panel would overflow", () => {
    // The To Do's filter button sits at the right edge of the action row, where a
    // left-aligned panel ran off screen.
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 120, x: 1040, y: 60},
      panelWidth: 340,
      ...viewport,
    });
    // Right edge of the panel lines up with the right edge of the trigger.
    expect(layout.left).toBe(1040 + 120 - 340);
  });

  it("clamps a right-aligned panel to the left screen margin", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 60, x: 100, y: 60},
      panelWidth: 340,
      viewportHeight: 800,
      viewportWidth: 360,
    });
    expect(layout.left).toBe(DROPDOWN_PANEL_SCREEN_MARGIN);
  });

  it("keeps a panel wider than the viewport at the left margin", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 60, x: 120, y: 60},
      panelWidth: 400,
      viewportHeight: 800,
      viewportWidth: 320,
    });
    expect(layout.left).toBe(DROPDOWN_PANEL_SCREEN_MARGIN);
  });

  it("honours an explicit alignment over the auto behaviour", () => {
    const anchor = {height: 40, width: 120, x: 400, y: 60};
    expect(
      computeDropdownPanelLayout({align: "end", anchor, panelWidth: 320, ...viewport}).left
    ).toBe(200);
    expect(
      computeDropdownPanelLayout({align: "start", anchor, panelWidth: 320, ...viewport}).left
    ).toBe(400);
  });

  it("flips above the trigger when there is no usable room below", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 120, x: 100, y: 720},
      panelWidth: 320,
      ...viewport,
    });
    expect(layout.placement).toBe("above");
    expect(layout.top).toBeUndefined();
    expect(layout.bottom).toBe(800 - 720 + 4);
  });

  it("stays below the trigger when the space above is even smaller", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 120, x: 100, y: 10},
      panelWidth: 320,
      viewportHeight: 220,
      viewportWidth: 1200,
    });
    expect(layout.placement).toBe("below");
  });

  it("caps the panel height to the space available and scrolls the rest", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 120, x: 100, y: 60},
      panelWidth: 320,
      ...viewport,
    });
    expect(layout.maxHeight).toBe(800 - 104 - DROPDOWN_PANEL_SCREEN_MARGIN);
  });

  it("never shrinks below the minimum usable height", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 120, x: 100, y: 120},
      panelWidth: 320,
      viewportHeight: 300,
      viewportWidth: 1200,
    });
    expect(layout.maxHeight).toBe(DROPDOWN_PANEL_MIN_HEIGHT);
  });

  it("applies a caller-supplied height ceiling", () => {
    const layout = computeDropdownPanelLayout({
      anchor: {height: 40, width: 120, x: 100, y: 60},
      maxPanelHeight: 240,
      panelWidth: 320,
      ...viewport,
    });
    expect(layout.maxHeight).toBe(240);
  });
});
