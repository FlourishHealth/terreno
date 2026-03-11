import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {Modal} from "./Modal";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("Modal", () => {
  it("renders correctly when visible", () => {
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Test Modal" visible>
        <Text>Modal content</Text>
      </Modal>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("does not show content when not visible", () => {
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Test Modal" visible={false}>
        <Text>Modal content</Text>
      </Modal>
    );
    // When not visible, the modal should not display content
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with title", () => {
    const {getByText} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Modal Title" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(getByText("Modal Title")).toBeTruthy();
  });

  it("renders with subtitle", () => {
    const {getByText} = renderWithTheme(
      <Modal onDismiss={() => {}} subtitle="Modal Subtitle" title="Title" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(getByText("Modal Subtitle")).toBeTruthy();
  });

  it("renders with text", () => {
    const {getByText} = renderWithTheme(
      <Modal onDismiss={() => {}} text="This is the modal body text" title="Title" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(getByText("This is the modal body text")).toBeTruthy();
  });

  it("renders children", () => {
    const {getByText} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Title" visible>
        <Text>Custom children content</Text>
      </Modal>
    );
    expect(getByText("Custom children content")).toBeTruthy();
  });

  it("renders with primary button", () => {
    const handleClick = mock(() => {});
    const {getByText} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        primaryButtonOnClick={handleClick}
        primaryButtonText="Confirm"
        title="Title"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );
    expect(getByText("Confirm")).toBeTruthy();
  });

  it("renders with secondary button", () => {
    const handleClick = mock(() => {});
    const {getByText} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        secondaryButtonOnClick={handleClick}
        secondaryButtonText="Cancel"
        title="Title"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );
    expect(getByText("Cancel")).toBeTruthy();
  });

  it("renders with both buttons", () => {
    const {getByText, toJSON} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        primaryButtonOnClick={() => {}}
        primaryButtonText="Save"
        secondaryButtonOnClick={() => {}}
        secondaryButtonText="Cancel"
        title="Confirm Action"
        visible
      >
        <Text>Are you sure?</Text>
      </Modal>
    );
    expect(getByText("Save")).toBeTruthy();
    expect(getByText("Cancel")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with disabled primary button", () => {
    const {toJSON} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        primaryButtonDisabled
        primaryButtonOnClick={() => {}}
        primaryButtonText="Save"
        title="Title"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onDismiss when close button is pressed", () => {
    const handleDismiss = mock(() => {});
    const {getByLabelText} = renderWithTheme(
      <Modal onDismiss={handleDismiss} title="Title" visible>
        <Text>Content</Text>
      </Modal>
    );

    fireEvent.press(getByLabelText("Close modal"));
    expect(handleDismiss).toHaveBeenCalled();
  });

  it("renders with small size", () => {
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} size="sm" title="Small Modal" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with medium size", () => {
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} size="md" title="Medium Modal" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with large size", () => {
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} size="lg" title="Large Modal" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
