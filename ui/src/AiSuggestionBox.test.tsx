import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {TextArea} from "./TextArea";
import {renderWithTheme} from "./test-utils";

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

    it("should call onAdd when Add to note is pressed", () => {
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

      fireEvent.press(getByLabelText("Add to note"));
      expect(mockOnAdd).toHaveBeenCalledTimes(1);
    });

    it("should collapse when Hide is pressed", () => {
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

      fireEvent.press(getByLabelText("Hide suggestion"));

      expect(queryByText("Suggestion text")).toBeNull();
      expect(getByText("AI-generated note (hidden)")).toBeTruthy();
      expect(getByText("Show")).toBeTruthy();
    });

    it("should expand when Show is pressed after collapsing", () => {
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

      fireEvent.press(getByLabelText("Hide suggestion"));
      expect(getByText("AI-generated note (hidden)")).toBeTruthy();

      fireEvent.press(getByLabelText("Show suggestion"));
      expect(getByText("Suggestion text")).toBeTruthy();
      expect(getByText("AI-generated note")).toBeTruthy();
    });
  });

  describe("added state", () => {
    it("should render added heading", () => {
      const {getByText} = renderWithTheme(
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
      expect(getByText("Added suggestion")).toBeTruthy();
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
