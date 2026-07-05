import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import type {ReactTestInstance} from "react-test-renderer";

import {AiSuggestionBox} from "./AiSuggestionBox";
import {TextArea} from "./TextArea";
import {renderWithTheme} from "./test-utils";

/**
 * Presses a Button-backed element and waits out the press handler's async haptic +
 * leading-edge debounce so the onClick side effects have applied before asserting.
 */
const pressButton = async (element: ReactTestInstance): Promise<void> => {
  await act(async () => {
    fireEvent.press(element);
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
};

describe("AiSuggestionBox in TextArea", () => {
  describe("not-started state", () => {
    it("should render default not-started text", () => {
      const {getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{onAdd: () => {}, status: "not-started"}}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("AI note will be generated once the session ends.")).toBeTruthy();
    });

    it("should render custom not-started text", () => {
      const {getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            notStartedText: "Custom pending message",
            onAdd: () => {},
            status: "not-started",
          }}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("Custom pending message")).toBeTruthy();
    });
  });

  describe("generating state", () => {
    it("should render default generating text", () => {
      const {getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{onAdd: () => {}, status: "generating"}}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("AI note generation in progress...")).toBeTruthy();
    });

    it("should render custom generating text", () => {
      const {getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            generatingText: "Thinking...",
            onAdd: () => {},
            status: "generating",
          }}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("Thinking...")).toBeTruthy();
    });
  });

  describe("ready state", () => {
    it("should render suggestion text", () => {
      const {getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            status: "ready",
            text: "This is a suggestion.",
          }}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("AI-generated note")).toBeTruthy();
      expect(getByText("This is a suggestion.")).toBeTruthy();
    });

    it("should render Hide and Add to note buttons", () => {
      const {getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            status: "ready",
            text: "Suggestion text",
          }}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("Hide")).toBeTruthy();
      expect(getByText("Add to note")).toBeTruthy();
    });

    it("should call onAdd when Add to note is pressed", async () => {
      const mockOnAdd = mock(() => {});
      const {getByLabelText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: mockOnAdd,
            status: "ready",
            text: "Suggestion text",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      await pressButton(getByLabelText("Add to note"));
      expect(mockOnAdd).toHaveBeenCalledTimes(1);
    });

    it("should collapse when Hide is pressed", async () => {
      const {getByLabelText, getByText, queryByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            status: "ready",
            text: "Suggestion text",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      expect(getByText("Suggestion text")).toBeTruthy();

      await pressButton(getByLabelText("Hide"));

      expect(queryByText("Suggestion text")).toBeNull();
      expect(getByText("AI-generated note (hidden)")).toBeTruthy();
      expect(getByText("Show")).toBeTruthy();
    });

    it("should expand when Show is pressed after collapsing", async () => {
      const {getByLabelText, getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            status: "ready",
            text: "Suggestion text",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      await pressButton(getByLabelText("Hide"));
      expect(getByText("AI-generated note (hidden)")).toBeTruthy();

      await pressButton(getByLabelText("Show"));
      expect(getByText("Suggestion text")).toBeTruthy();
      expect(getByText("AI-generated note")).toBeTruthy();
    });

    it("should call onHide when Hide is pressed", async () => {
      const mockOnHide = mock(() => {});
      const {getByLabelText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            onHide: mockOnHide,
            status: "ready",
            text: "Suggestion text",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      await pressButton(getByLabelText("Hide"));
      expect(mockOnHide).toHaveBeenCalledTimes(1);
    });

    it("should call onShow when Show is pressed", async () => {
      const mockOnShow = mock(() => {});
      const {getByLabelText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            onShow: mockOnShow,
            status: "ready",
            text: "Suggestion text",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      await pressButton(getByLabelText("Hide"));
      await pressButton(getByLabelText("Show"));
      expect(mockOnShow).toHaveBeenCalledTimes(1);
    });
  });

  describe("hidden state", () => {
    it("should render collapsed with the hidden heading", () => {
      const {getByText, queryByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            status: "hidden",
            text: "Hidden suggestion",
          }}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("AI-generated note (hidden)")).toBeTruthy();
      expect(getByText("Show")).toBeTruthy();
      expect(queryByText("Hidden suggestion")).toBeNull();
    });

    it("should call onShow and expand when Show is pressed", async () => {
      const mockOnShow = mock(() => {});
      const {getByLabelText, getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            onShow: mockOnShow,
            status: "hidden",
            text: "Hidden suggestion",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      await pressButton(getByLabelText("Show"));

      expect(mockOnShow).toHaveBeenCalledTimes(1);
      expect(getByText("Hidden suggestion")).toBeTruthy();
    });
  });

  describe("added state", () => {
    it("should render collapsed with the added heading", () => {
      const {getByText, queryByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            status: "added",
            text: "Added suggestion",
          }}
          onChange={() => {}}
          value=""
        />
      );

      expect(getByText("AI-generated note added!")).toBeTruthy();
      expect(getByText("Show")).toBeTruthy();
      expect(queryByText("Added suggestion")).toBeNull();
    });

    it("should expand locally on Show without persisting, keeping Add to note available", async () => {
      const mockOnShow = mock(() => {});
      const {getByLabelText, getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            onShow: mockOnShow,
            status: "added",
            text: "Added suggestion",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      await pressButton(getByLabelText("Show"));

      // Expanding an added suggestion must not call onShow — that would reset the
      // persisted acceptance record.
      expect(mockOnShow).not.toHaveBeenCalled();
      expect(getByText("Added suggestion")).toBeTruthy();
      expect(getByText("Add to note")).toBeTruthy();
    });

    it("should collapse locally on Hide without persisting", async () => {
      const mockOnHide = mock(() => {});
      const {getByLabelText, getByText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            onHide: mockOnHide,
            status: "added",
            text: "Added suggestion",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      await pressButton(getByLabelText("Show"));
      await pressButton(getByLabelText("Hide"));

      expect(mockOnHide).not.toHaveBeenCalled();
      expect(getByText("AI-generated note added!")).toBeTruthy();
    });
  });

  describe("collapse behavior across status transitions", () => {
    it("should collapse when the status transitions from ready to added", () => {
      const {getByText, queryByText, rerender} = renderWithTheme(
        <AiSuggestionBox onAdd={() => {}} status="ready" text="Suggestion text" />
      );

      expect(getByText("Suggestion text")).toBeTruthy();

      rerender(<AiSuggestionBox onAdd={() => {}} status="added" text="Suggestion text" />);

      expect(getByText("AI-generated note added!")).toBeTruthy();
      expect(queryByText("Suggestion text")).toBeNull();
    });

    it("should keep the box expanded when a stale hide lands after a newer Show click", async () => {
      const mockOnHide = mock(() => {});
      const mockOnShow = mock(() => {});
      const suggestion = {
        onAdd: () => {},
        onHide: mockOnHide,
        onShow: mockOnShow,
        text: "Suggestion text",
      };
      const {getByLabelText, getByText, queryByText, rerender} = renderWithTheme(
        <AiSuggestionBox status="ready" {...suggestion} />
      );

      await pressButton(getByLabelText("Hide"));
      expect(mockOnHide).toHaveBeenCalledTimes(1);

      await pressButton(getByLabelText("Show"));
      // A Show clicked while the hide is still in flight must persist the un-hide too,
      // so the backend converges on the user's latest choice.
      expect(mockOnShow).toHaveBeenCalledTimes(1);
      expect(getByText("Suggestion text")).toBeTruthy();

      // The earlier hide's refetch lands after the newer Show click — the box must not
      // snap back to collapsed.
      rerender(<AiSuggestionBox status="hidden" {...suggestion} />);
      expect(getByText("Suggestion text")).toBeTruthy();
      expect(queryByText("AI-generated note (hidden)")).toBeNull();

      // The show mutation then lands and the box stays expanded.
      rerender(<AiSuggestionBox status="ready" {...suggestion} />);
      expect(getByText("Suggestion text")).toBeTruthy();
    });
  });

  describe("feedback", () => {
    it("should call onFeedback with 'like' when thumbs up is pressed", () => {
      const mockOnFeedback = mock(() => {});
      const {getByLabelText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            feedback: null,
            onAdd: () => {},
            onFeedback: mockOnFeedback,
            status: "ready",
            text: "Suggestion",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      fireEvent.press(getByLabelText("Thumbs up"));
      expect(mockOnFeedback).toHaveBeenCalledWith("like");
    });

    it("should call onFeedback with null when thumbs up is pressed while already liked", () => {
      const mockOnFeedback = mock(() => {});
      const {getByLabelText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            feedback: "like",
            onAdd: () => {},
            onFeedback: mockOnFeedback,
            status: "ready",
            text: "Suggestion",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      fireEvent.press(getByLabelText("Thumbs up"));
      expect(mockOnFeedback).toHaveBeenCalledWith(null);
    });

    it("should call onFeedback with 'dislike' when thumbs down is pressed", () => {
      const mockOnFeedback = mock(() => {});
      const {getByLabelText} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            feedback: null,
            onAdd: () => {},
            onFeedback: mockOnFeedback,
            status: "ready",
            text: "Suggestion",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );

      fireEvent.press(getByLabelText("Thumbs down"));
      expect(mockOnFeedback).toHaveBeenCalledWith("dislike");
    });
  });

  describe("testID propagation", () => {
    it("should apply testIDs to interactive elements", () => {
      const {getByTestId} = renderWithTheme(
        <TextArea
          aiSuggestion={{
            onAdd: () => {},
            status: "ready",
            text: "Suggestion",
          }}
          onChange={() => {}}
          testID="notes"
          value=""
        />
      );

      expect(getByTestId("notes-ai-suggestion")).toBeTruthy();
      expect(getByTestId("notes-ai-suggestion-thumbs-up")).toBeTruthy();
      expect(getByTestId("notes-ai-suggestion-thumbs-down")).toBeTruthy();
      expect(getByTestId("notes-ai-suggestion-hide")).toBeTruthy();
      expect(getByTestId("notes-ai-suggestion-add")).toBeTruthy();
    });
  });

  describe("snapshots", () => {
    it("should match snapshot for not-started state", () => {
      const component = renderWithTheme(
        <TextArea
          aiSuggestion={{onAdd: () => {}, status: "not-started"}}
          onChange={() => {}}
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot for generating state", () => {
      const component = renderWithTheme(
        <TextArea
          aiSuggestion={{onAdd: () => {}, status: "generating"}}
          onChange={() => {}}
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot for ready state", () => {
      const component = renderWithTheme(
        <TextArea
          aiSuggestion={{
            feedback: null,
            onAdd: () => {},
            status: "ready",
            text: "AI-generated suggestion text.",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot for hidden state", () => {
      const component = renderWithTheme(
        <TextArea
          aiSuggestion={{
            feedback: null,
            onAdd: () => {},
            status: "hidden",
            text: "AI-generated suggestion text.",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot for added state", () => {
      const component = renderWithTheme(
        <TextArea
          aiSuggestion={{
            feedback: "like",
            onAdd: () => {},
            status: "added",
            text: "AI-generated suggestion text.",
          }}
          onChange={() => {}}
          testID="test"
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });
  });
});
