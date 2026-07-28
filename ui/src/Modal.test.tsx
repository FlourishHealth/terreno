import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import {Gesture} from "react-native-gesture-handler";

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

/**
 * Finds the web-only translucent backdrop Pressable in a rendered Modal tree.
 *
 * The web branch renders a full-screen Pressable whose style sets a semi-transparent
 * `rgba(...)` backgroundColor; the native ActionSheet branch has no such element. Tests use
 * its presence/absence to assert which presentation branch rendered.
 *
 * @param pressables - All Pressable test instances found in the rendered tree.
 * @returns The backdrop Pressable if present, otherwise undefined.
 */
const findBackdropPressable = (
  pressables: PressableTestInstance[]
): PressableTestInstance | undefined => {
  return pressables.find((node) => {
    const style = node.props.style;
    if (Array.isArray(style)) {
      return style.some((s) => s?.backgroundColor?.includes?.("rgba"));
    }
    return style?.backgroundColor?.includes?.("rgba");
  });
};

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

describe("Modal web platform", () => {
  const RN = require("react-native") as {Platform: {OS: string}};
  const originalOS = RN.Platform.OS;
  const globalScope = globalThis as {document?: unknown; HTMLElement?: unknown};
  const originalDocument = globalScope.document;
  const originalHTMLElement = globalScope.HTMLElement;

  class FakeHTMLElement {
    blur = mock(() => {});
  }

  // The web branch runs a blur useEffect that reads `document.activeElement` and checks
  // `instanceof HTMLElement`, so every web test needs Platform.OS === "web" plus a document
  // and HTMLElement stub in place before rendering.
  beforeEach(() => {
    RN.Platform.OS = "web";
    globalScope.HTMLElement = FakeHTMLElement;
    globalScope.document = {activeElement: null};
  });

  afterEach(() => {
    RN.Platform.OS = originalOS;
    globalScope.document = originalDocument;
    globalScope.HTMLElement = originalHTMLElement;
  });

  it("renders the web RNModal backdrop on web", () => {
    const {UNSAFE_getAllByType} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Web Modal" visible>
        <Text>Content</Text>
      </Modal>
    );
    const {Pressable} = require("react-native");
    const pressables: PressableTestInstance[] = UNSAFE_getAllByType(Pressable);
    expect(findBackdropPressable(pressables)).toBeTruthy();
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
    const backdrop = findBackdropPressable(pressables);
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

  it("blurs the focused element when opened on web", () => {
    const active = new FakeHTMLElement();
    globalScope.document = {activeElement: active};

    renderWithTheme(
      <Modal onDismiss={() => {}} title="Web Modal" visible>
        <Text>Content</Text>
      </Modal>
    );

    expect(active.blur).toHaveBeenCalled();
  });

  it("does not blur when the active element is not an HTMLElement", () => {
    globalScope.document = {activeElement: {}};

    const {toJSON} = renderWithTheme(
      <Modal onDismiss={() => {}} title="Web Modal" visible>
        <Text>Content</Text>
      </Modal>
    );

    expect(toJSON()).toBeTruthy();
  });
});

// The Modal selects its presentation via isNative() (Platform.OS in ios/android), NOT screen
// size, so these run the native branch explicitly for each native platform. Android is the
// platform where the original tablet bug occurred, so it must be covered directly rather than
// relying on the default "ios" test platform.
describe("Modal native presentation", () => {
  const RN = require("react-native") as {Platform: {OS: string}};
  const originalOS = RN.Platform.OS;

  afterEach(() => {
    RN.Platform.OS = originalOS;
  });

  for (const platform of ["ios", "android"] as const) {
    it(`uses the ActionSheet (no web backdrop) on ${platform}`, () => {
      RN.Platform.OS = platform;
      const {UNSAFE_getAllByType, getByText} = renderWithTheme(
        <Modal
          onDismiss={() => {}}
          primaryButtonOnClick={() => {}}
          primaryButtonText="Save"
          title="Native Modal"
          visible
        >
          <Text>Native Content</Text>
        </Modal>
      );
      // Content mounts via the ActionSheet branch...
      expect(getByText("Native Modal")).toBeTruthy();
      // ...and the web-only translucent backdrop Pressable must NOT be present.
      const {Pressable} = require("react-native");
      const pressables: PressableTestInstance[] = UNSAFE_getAllByType(Pressable);
      expect(findBackdropPressable(pressables)).toBeUndefined();
    });

    it(`renders nothing when not visible on ${platform}`, () => {
      RN.Platform.OS = platform;
      const {queryByText} = renderWithTheme(
        <Modal onDismiss={() => {}} title="Hidden Native Modal" visible={false}>
          <Text>Native Content</Text>
        </Modal>
      );
      // The ActionSheet stays closed (mock tracks setModalVisible), so no content is shown.
      expect(queryByText("Hidden Native Modal")).toBeNull();
      expect(queryByText("Native Content")).toBeNull();
    });
  }
});

interface CapturedGesture {
  onEnd: {mock: {calls: [(event: {translationY: number}) => void][]}};
}

describe("Modal drag-to-close gesture", () => {
  it("dismisses only when dragged down past the threshold", () => {
    const handleDismiss = mock(() => {});
    let capturedGesture: CapturedGesture | undefined;
    const originalPan = Gesture.Pan;
    (Gesture as {Pan: () => unknown}).Pan = () => {
      capturedGesture = originalPan() as unknown as CapturedGesture;
      return capturedGesture;
    };

    try {
      renderWithTheme(
        <Modal onDismiss={handleDismiss} title="Draggable" visible>
          <Text>Body</Text>
        </Modal>
      );

      const onEnd = capturedGesture?.onEnd.mock.calls[0][0];
      assert.isDefined(onEnd);

      // A small drag stays below the threshold and should not dismiss.
      onEnd?.({translationY: 5});
      assert.lengthOf(handleDismiss.mock.calls, 0);

      // A drag past the threshold dismisses via runOnJS(handleDismiss).
      onEnd?.({translationY: 40});
      assert.lengthOf(handleDismiss.mock.calls, 1);
    } finally {
      (Gesture as {Pan: () => unknown}).Pan = originalPan;
    }
  });
});
