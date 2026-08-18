import {describe, expect, it, jest} from "bun:test";
import {fireEvent, waitFor} from "@testing-library/react-native";

import {DocumentPopover} from "./DocumentPopover";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("DocumentPopover", () => {
  it("renders the title, date and body when loaded", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <DocumentPopover
        onClose={jest.fn()}
        subtitle="11/20/2026"
        testID="popover"
        text="Summary of Patient History."
        title="Document Title"
      />
    );
    expect(getByTestId("popover-title")).toBeTruthy();
    expect(getByTestId("popover-subtitle")).toBeTruthy();
    expect(getByText("Summary of Patient History.")).toBeTruthy();
  });

  it("prefers children over text for the body", () => {
    const {getByText, queryByText} = renderWithTheme(
      <DocumentPopover onClose={jest.fn()} text="Plain summary">
        <Text>Rich body</Text>
      </DocumentPopover>
    );
    expect(getByText("Rich body")).toBeTruthy();
    expect(queryByText("Plain summary")).toBeNull();
  });

  it("calls onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    const {getByLabelText} = renderWithTheme(<DocumentPopover onClose={onClose} title="Doc" />);
    fireEvent.press(getByLabelText("Close document"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onOpen from the footer action", () => {
    const onOpen = jest.fn();
    const {getByTestId} = renderWithTheme(
      <DocumentPopover onClose={jest.fn()} onOpen={onOpen} testID="popover" title="Doc" />
    );
    fireEvent.press(getByTestId("popover-open"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("passes feedback selections through", () => {
    const onFeedbackChange = jest.fn();
    const {getByTestId} = renderWithTheme(
      <DocumentPopover
        onClose={jest.fn()}
        onFeedbackChange={onFeedbackChange}
        testID="popover"
        title="Doc"
      />
    );
    fireEvent.press(getByTestId("popover-feedback-positive"));
    expect(onFeedbackChange).toHaveBeenCalledWith("positive");
  });

  it("hides the footer when there are no footer actions", () => {
    const {queryByTestId} = renderWithTheme(
      <DocumentPopover onClose={jest.fn()} testID="popover" title="Doc" />
    );
    expect(queryByTestId("popover-open")).toBeNull();
    expect(queryByTestId("popover-feedback")).toBeNull();
  });

  it("shows the loading header instead of the document while loading", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <DocumentPopover onClose={jest.fn()} status="loading" testID="popover" title="Doc" />
    );
    expect(getByTestId("popover-loading-text")).toBeTruthy();
    expect(queryByTestId("popover-title")).toBeNull();
  });

  it("shows a retryable error message when loading fails", async () => {
    const onRetry = jest.fn();
    const {getByTestId} = renderWithTheme(
      <DocumentPopover
        onClose={jest.fn()}
        onRetry={onRetry}
        status="error"
        testID="popover"
        title="Doc"
      />
    );
    expect(getByTestId("popover-error-title")).toBeTruthy();
    fireEvent.press(getByTestId("popover-retry"));
    await waitFor(() => {
      expect(onRetry).toHaveBeenCalled();
    });
  });

  it("hides the retry button when there is no retry handler", () => {
    const {queryByTestId} = renderWithTheme(
      <DocumentPopover onClose={jest.fn()} status="error" testID="popover" />
    );
    expect(queryByTestId("popover-retry")).toBeNull();
  });

  it("bounds the body viewport without pinning the scroll content height", () => {
    const {getByText, root} = renderWithTheme(
      <DocumentPopover
        contentHeight={240}
        onClose={jest.fn()}
        text={"Summary of Patient History. ".repeat(40)}
        title="Doc"
      />
    );

    expect(getByText(/Summary of Patient History/)).toBeTruthy();
    const scrollView = root.findByType("ScrollView");
    expect(scrollView.props.style).toEqual(expect.objectContaining({height: 240}));
    const contentView = scrollView.findByType("View");
    expect(contentView.props.style).not.toEqual(expect.objectContaining({height: 240}));
  });
});
