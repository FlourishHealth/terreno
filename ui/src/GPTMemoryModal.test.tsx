import {describe, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";

import {GPTMemoryModal} from "./GPTMemoryModal";
import {renderWithTheme} from "./test-utils";

// Button presses run through an async haptic call, so state updates land in a microtask after
// the event.
const press = async (element: Parameters<typeof fireEvent.press>[0]): Promise<void> => {
  await act(async () => {
    fireEvent.press(element);
  });
};

describe("GPTMemoryModal", () => {
  it("renders the title, subtitle, and the current memory", () => {
    const {getByText, getByTestId, getByPlaceholderText} = renderWithTheme(
      <GPTMemoryModal memory="Be concise." onDismiss={() => {}} onSave={() => {}} visible />
    );

    assert.isOk(getByText("System Memory"));
    assert.isOk(getByText("Customize the system prompt for your AI assistant."));
    assert.isOk(getByPlaceholderText("Enter system instructions..."));
    assert.equal(getByTestId("gpt-memory-textarea").props.value, "Be concise.");
  });

  it("saves the edited memory and dismisses", async () => {
    const onSave = mock((_memory: string) => {});
    const onDismiss = mock(() => {});
    const {getByTestId, getByText} = renderWithTheme(
      <GPTMemoryModal memory="Old" onDismiss={onDismiss} onSave={onSave} visible />
    );

    fireEvent.changeText(getByTestId("gpt-memory-textarea"), "New instructions");
    assert.equal(getByTestId("gpt-memory-textarea").props.value, "New instructions");

    await press(getByText("Save"));

    assert.equal(onSave.mock.calls.length, 1);
    assert.deepEqual(onSave.mock.calls[0], ["New instructions"]);
    assert.equal(onDismiss.mock.calls.length, 1);
  });

  it("cancels without saving", async () => {
    const onSave = mock((_memory: string) => {});
    const onDismiss = mock(() => {});
    const {getByTestId, getByText} = renderWithTheme(
      <GPTMemoryModal memory="Old" onDismiss={onDismiss} onSave={onSave} visible />
    );

    fireEvent.changeText(getByTestId("gpt-memory-textarea"), "Discarded");
    await press(getByText("Cancel"));

    assert.equal(onSave.mock.calls.length, 0);
    assert.equal(onDismiss.mock.calls.length, 1);
  });

  it("renders nothing visible when not visible", () => {
    const {queryByText} = renderWithTheme(
      <GPTMemoryModal memory="" onDismiss={() => {}} onSave={() => {}} visible={false} />
    );

    assert.isNull(queryByText("System Memory"));
  });
});
