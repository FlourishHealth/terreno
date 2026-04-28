import {afterEach, describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {isMobileDevice} from "./MediaQuery";
import {Modal} from "./Modal";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

// Minimal shape of a test instance returned by UNSAFE_getAllByType that we rely on here.
interface PressableTestInstance {
  props: {
    style?:
      | {backgroundColor?: string; cursor?: string}
      | {backgroundColor?: string; cursor?: string}[];
    onPress?: (event?: {stopPropagation?: () => void}) => void;
  };
}

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

  it("dismisses when the backdrop is pressed and persistOnBackgroundClick is false", () => {
    const handleDismiss = mock(() => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <Modal onDismiss={handleDismiss} title="Title" visible>
        <Text>Content</Text>
      </Modal>
    );
    // Find the backdrop Pressable (first Pressable in tree with a style that includes backgroundColor).
    const {Pressable} = require("react-native");
    const pressables: PressableTestInstance[] = UNSAFE_getAllByType(Pressable);
    const backdrop = pressables.find((node) => {
      const style = node.props.style;
      if (Array.isArray(style)) {
        return style.some((s) => s?.backgroundColor?.includes?.("rgba"));
      }
      return style?.backgroundColor?.includes?.("rgba");
    });
    expect(backdrop).toBeTruthy();
    backdrop?.props.onPress?.();
    expect(handleDismiss).toHaveBeenCalled();
  });

  it("stops propagation on the inner backdrop wrapper press", () => {
    const stopPropagation = mock(() => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Title" visible>
        <Text>Content</Text>
      </Modal>
    );
    const {Pressable} = require("react-native");
    const pressables: PressableTestInstance[] = UNSAFE_getAllByType(Pressable);
    // Inner wrapper is the pressable with style {cursor: "auto"}.
    const inner = pressables.find((node) => node.props.style?.cursor === "auto");
    expect(inner).toBeTruthy();
    inner?.props.onPress?.({stopPropagation});
    expect(stopPropagation).toHaveBeenCalled();
  });

  it("does not stop propagation on the inner wrapper when persistOnBackgroundClick is true", () => {
    const stopPropagation = mock(() => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <Modal onDismiss={() => {}} persistOnBackgroundClick title="Title" visible>
        <Text>Content</Text>
      </Modal>
    );
    const {Pressable} = require("react-native");
    const pressables: PressableTestInstance[] = UNSAFE_getAllByType(Pressable);
    const inner = pressables.find((node) => node.props.style?.cursor === "auto");
    expect(inner).toBeTruthy();
    inner?.props.onPress?.({stopPropagation});
    expect(stopPropagation).not.toHaveBeenCalled();
  });
});

describe("Modal mobile branch", () => {
  afterEach(() => {
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => false);
  });

  it("renders ActionSheet when isMobileDevice is true", () => {
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => true);
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Mobile Modal" visible>
        <Text>Mobile Content</Text>
      </Modal>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders ActionSheet with title and buttons on mobile", () => {
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => true);
    const {toJSON} = renderWithTheme(
      <Modal
        onDismiss={() => {}}
        primaryButtonOnClick={() => {}}
        primaryButtonText="Save"
        secondaryButtonOnClick={() => {}}
        secondaryButtonText="Cancel"
        title="Mobile Actions"
        visible
      >
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders ActionSheet with persistOnBackgroundClick disabled", () => {
    (isMobileDevice as ReturnType<typeof mock>).mockImplementation(() => true);
    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Persistent Mobile" visible>
        <Text>Content</Text>
      </Modal>
    );
    expect(toJSON()).toBeTruthy();
  });
});
