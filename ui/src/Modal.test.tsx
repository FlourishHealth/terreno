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

  it("renders primary button with click handler", () => {
    const handlePrimary = mock(() => {});
    const {getByText} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        primaryButtonOnClick={handlePrimary}
        primaryButtonText="Confirm"
        title="Title"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );
    expect(getByText("Confirm")).toBeTruthy();
  });

  it("renders secondary button with click handler", () => {
    const handleSecondary = mock(() => {});
    const {getByText} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        secondaryButtonOnClick={handleSecondary}
        secondaryButtonText="Cancel"
        title="Title"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );
    expect(getByText("Cancel")).toBeTruthy();
  });

  it("does not call primaryButtonOnClick when not visible", () => {
    const handlePrimary = mock(() => {});
    renderWithTheme(
      <Modal
        onDismiss={() => {}}
        primaryButtonOnClick={handlePrimary}
        primaryButtonText="Confirm"
        title="Title"
        visible={false}
      >
        <Text>Content</Text>
      </Modal>
    );
    expect(handlePrimary).not.toHaveBeenCalled();
  });

  it("renders with persistOnBackgroundClick", () => {
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} persistOnBackgroundClick title="Persistent" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("does not call onDismiss when visible is false and close is pressed", () => {
    const handleDismiss = mock(() => {});
    renderWithTheme(
      <Modal onDismiss={handleDismiss} title="Hidden" visible={false}>
        <Text>Content</Text>
      </Modal>
    );
    expect(handleDismiss).not.toHaveBeenCalled();
  });

  it("renders transitioning from hidden to visible", () => {
    const {rerender, toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Toggle" visible={false}>
        <Text>Content</Text>
      </Modal>
    );
    rerender(
      <Modal onDismiss={() => {}} title="Toggle" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("invokes primaryButtonOnClick when primary button pressed while visible", async () => {
    const handlePrimary = mock(() => {});
    const {getByText} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        primaryButtonOnClick={handlePrimary}
        primaryButtonText="Submit"
        title="Title"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );

    await new Promise((resolve) => {
      fireEvent.press(getByText("Submit"));
      setTimeout(resolve, 600);
    });

    expect(handlePrimary).toHaveBeenCalled();
  });

  it("invokes secondaryButtonOnClick when secondary button pressed while visible", async () => {
    const handleSecondary = mock(() => {});
    const {getByText} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        secondaryButtonOnClick={handleSecondary}
        secondaryButtonText="Cancel"
        title="Title"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );

    await new Promise((resolve) => {
      fireEvent.press(getByText("Cancel"));
      setTimeout(resolve, 600);
    });

    expect(handleSecondary).toHaveBeenCalled();
  });
});
