import {describe, expect, it} from "bun:test";
import {act} from "@testing-library/react-native";

import {CitationTooltip} from "./CitationTooltip";
import {renderWithTheme} from "./test-utils";

interface TouchEventShape {
  nativeEvent: {pageX: number; pageY: number};
}

interface BackdropProps {
  onPress?: () => void;
  onTouchEnd?: () => void;
  onTouchMove?: (event: TouchEventShape) => void;
  onTouchStart?: (event: TouchEventShape) => void;
}

const touchEvent = (pageX: number, pageY: number): TouchEventShape => ({
  nativeEvent: {pageX, pageY},
});

const renderTooltip = () =>
  renderWithTheme(
    <CitationTooltip content="Citation content body" header="Smith et al., 2023" marker="1" />
  );

const openTooltip = async (result: ReturnType<typeof renderTooltip>): Promise<void> => {
  await act(async () => {
    (result.getByTestId("citation-tooltip-trigger").props as {onPress: () => void}).onPress();
  });
};

describe("CitationTooltip", () => {
  it("renders the marker badge", () => {
    const {getByText, queryByTestId} = renderTooltip();
    expect(getByText("1")).toBeTruthy();
    expect(queryByTestId("citation-tooltip-popover")).toBeNull();
  });

  it("opens the popover when the marker is pressed", async () => {
    const result = renderTooltip();
    await openTooltip(result);

    expect(result.queryByTestId("citation-tooltip-popover")).toBeTruthy();
    expect(result.getByText("Smith et al., 2023")).toBeTruthy();
    expect(result.getByText("Citation content body")).toBeTruthy();
  });

  it("dismisses when the backdrop is pressed", async () => {
    const result = renderTooltip();
    await openTooltip(result);

    const backdrop = result.getByTestId("citation-tooltip-backdrop").props as BackdropProps;
    await act(async () => {
      backdrop.onPress?.();
    });

    expect(result.queryByTestId("citation-tooltip-popover")).toBeNull();
  });

  it("dismisses when a touch on the backdrop moves beyond the scroll slop", async () => {
    const result = renderTooltip();
    await openTooltip(result);

    const backdrop = result.getByTestId("citation-tooltip-backdrop").props as BackdropProps;
    await act(async () => {
      backdrop.onTouchStart?.(touchEvent(100, 100));
      backdrop.onTouchMove?.(touchEvent(100, 130));
    });

    expect(result.queryByTestId("citation-tooltip-popover")).toBeNull();
  });

  it("stays open when a backdrop touch moves within the scroll slop", async () => {
    const result = renderTooltip();
    await openTooltip(result);

    const backdrop = result.getByTestId("citation-tooltip-backdrop").props as BackdropProps;
    await act(async () => {
      backdrop.onTouchStart?.(touchEvent(100, 100));
      backdrop.onTouchMove?.(touchEvent(103, 104));
      backdrop.onTouchEnd?.();
    });

    expect(result.queryByTestId("citation-tooltip-popover")).toBeTruthy();
  });

  it("ignores backdrop touch moves that have no recorded touch start", async () => {
    const result = renderTooltip();
    await openTooltip(result);

    const backdrop = result.getByTestId("citation-tooltip-backdrop").props as BackdropProps;
    await act(async () => {
      backdrop.onTouchMove?.(touchEvent(100, 200));
    });

    expect(result.queryByTestId("citation-tooltip-popover")).toBeTruthy();
  });

  it("toggles closed when the marker is pressed a second time", async () => {
    const result = renderTooltip();
    await openTooltip(result);
    await openTooltip(result);

    expect(result.queryByTestId("citation-tooltip-popover")).toBeNull();
  });
});
