import {describe, it} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import {summarizeExampleTextMock, todoSummaryTestState} from "../tests/todoSummaryTestState";

import {TodoSummaryCard} from "./TodoSummaryCard";

describe("TodoSummaryCard", () => {
  it("disables summarize when there are no todos", () => {
    todoSummaryTestState.todos = [];
    todoSummaryTestState.error = undefined;
    const view = renderWithTheme(<TodoSummaryCard />);

    assert.exists(view.getByTestId("todos-summary-empty"));
    const button = view.getByTestId("todos-summarize-button");
    assert.isTrue(button.props.accessibilityState?.disabled ?? button.props.disabled);
  });

  it("renders the unwrapped summary response", async () => {
    todoSummaryTestState.todos = [{completed: false, id: "todo-1", text: "Ship observability"}];
    todoSummaryTestState.error = undefined;
    summarizeExampleTextMock.mockClear();
    const view = renderWithTheme(<TodoSummaryCard />);

    await act(async () => {
      fireEvent.press(view.getByTestId("todos-summarize-button"));
      await Promise.resolve();
    });

    assert.equal(summarizeExampleTextMock.mock.calls.length, 1);
    assert.exists(view.getByText("Two todos remain."));
  });

  it("shows the API error title", async () => {
    todoSummaryTestState.todos = [{completed: false, id: "todo-1", text: "Ship observability"}];
    todoSummaryTestState.error = {data: {title: "Provide an AI API key."}};
    const view = renderWithTheme(<TodoSummaryCard />);

    await act(async () => {
      fireEvent.press(view.getByTestId("todos-summarize-button"));
      await Promise.resolve();
    });

    assert.exists(view.getByText("Provide an AI API key."));
  });
});
