import {afterAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {fireEvent, waitFor} from "@testing-library/react-native";
import {Pressable} from "react-native";

// Override the IconButton mock so the onClick fires when pressed.
mock.module("./IconButton", () => ({
  IconButton: ({
    accessibilityLabel,
    disabled,
    onClick,
    testID,
  }: {
    accessibilityLabel?: string;
    disabled?: boolean;
    onClick?: () => void;
    testID?: string;
  }) => (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onClick}
      testID={testID}
    />
  ),
}));

afterAll(() => {
  mock.module("./IconButton", () => ({
    IconButton: mock(() => null),
  }));
});

import {FilePickerButton, type SelectedFile} from "./FilePickerButton";
import {renderWithTheme} from "./test-utils";

interface ImagePickerResult {
  assets: Array<{fileName?: string; mimeType?: string; uri: string}>;
  canceled: boolean;
}

interface DocumentPickerResult {
  assets: Array<{mimeType?: string; name: string; uri: string}>;
  canceled: boolean;
}

let imagePickerResult: ImagePickerResult = {assets: [], canceled: true};
let documentPickerResult: DocumentPickerResult = {assets: [], canceled: true};
const launchImageLibraryAsync = mock(async (): Promise<ImagePickerResult> => imagePickerResult);
const getDocumentAsync = mock(async (): Promise<DocumentPickerResult> => documentPickerResult);

mock.module("expo-image-picker", () => ({launchImageLibraryAsync}));
mock.module("expo-document-picker", () => ({getDocumentAsync}));

const openModal = (
  multiple = false
): {files: SelectedFile[][]; getByText: typeof result.getByText} => {
  const files: SelectedFile[][] = [];
  const result = renderWithTheme(
    <FilePickerButton multiple={multiple} onFilesSelected={(selected) => files.push(selected)} />
  );
  fireEvent.press(result.getByTestId("file-picker-button"));
  return {files, getByText: result.getByText};
};

describe("FilePickerButton", () => {
  beforeEach(() => {
    imagePickerResult = {assets: [], canceled: true};
    documentPickerResult = {assets: [], canceled: true};
    launchImageLibraryAsync.mockClear();
    getDocumentAsync.mockClear();
  });

  it("renders with default and custom testIDs", () => {
    const {getByTestId} = renderWithTheme(<FilePickerButton onFilesSelected={() => {}} />);
    expect(getByTestId("file-picker-button")).toBeTruthy();
    const custom = renderWithTheme(<FilePickerButton onFilesSelected={() => {}} testID="custom" />);
    expect(custom.getByTestId("custom")).toBeTruthy();
  });

  it("passes disabled through to the trigger button", () => {
    const {getByTestId} = renderWithTheme(<FilePickerButton disabled onFilesSelected={() => {}} />);
    expect(getByTestId("file-picker-button").props.accessibilityState).toEqual({disabled: true});
  });

  it("opens the attach modal with both options", () => {
    const {getByText} = openModal();
    expect(getByText("Attach")).toBeTruthy();
    expect(getByText("Photo Library")).toBeTruthy();
    expect(getByText("Document")).toBeTruthy();
  });

  it("dismisses the modal via the close control", () => {
    const {getByLabelText} = renderWithTheme(<FilePickerButton onFilesSelected={() => {}} />);
    fireEvent.press(getByLabelText("Attach file"));
    fireEvent.press(getByLabelText("Close modal"));
  });

  it("maps picked images and applies default mime type and name", async () => {
    imagePickerResult = {
      assets: [
        {fileName: "pic.png", mimeType: "image/png", uri: "file:///pic.png"},
        {uri: "file:///unnamed"},
      ],
      canceled: false,
    };
    const {files, getByText} = openModal(true);
    fireEvent.press(getByText("Photo Library"));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(launchImageLibraryAsync).toHaveBeenCalledWith({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 0.8,
    });
    expect(files[0][0]).toEqual({mimeType: "image/png", name: "pic.png", uri: "file:///pic.png"});
    expect(files[0][1].mimeType).toBe("image/jpeg");
    expect(files[0][1].name).toMatch(/^image-\d+\.jpg$/);
    expect(files[0][1].uri).toBe("file:///unnamed");
  });

  it("does nothing when the image picker is canceled or returns no assets", async () => {
    const canceled = openModal();
    fireEvent.press(canceled.getByText("Photo Library"));
    await waitFor(() => expect(launchImageLibraryAsync).toHaveBeenCalledTimes(1));
    expect(canceled.files).toHaveLength(0);

    imagePickerResult = {assets: [], canceled: false};
    const empty = openModal();
    fireEvent.press(empty.getByText("Photo Library"));
    await waitFor(() => expect(launchImageLibraryAsync).toHaveBeenCalledTimes(2));
    expect(empty.files).toHaveLength(0);
  });

  it("maps picked documents and applies default mime type", async () => {
    documentPickerResult = {
      assets: [
        {mimeType: "application/pdf", name: "report.pdf", uri: "file:///report.pdf"},
        {name: "notes.txt", uri: "file:///notes.txt"},
      ],
      canceled: false,
    };
    const {files, getByText} = openModal();
    fireEvent.press(getByText("Document"));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(getDocumentAsync).toHaveBeenCalledWith({
      multiple: false,
      type: ["application/pdf", "text/plain", "text/csv", "application/json"],
    });
    expect(files[0]).toEqual([
      {mimeType: "application/pdf", name: "report.pdf", uri: "file:///report.pdf"},
      {mimeType: "application/octet-stream", name: "notes.txt", uri: "file:///notes.txt"},
    ]);
  });

  it("does nothing when the document picker is canceled or returns no assets", async () => {
    const canceled = openModal();
    fireEvent.press(canceled.getByText("Document"));
    await waitFor(() => expect(getDocumentAsync).toHaveBeenCalledTimes(1));
    expect(canceled.files).toHaveLength(0);

    documentPickerResult = {assets: [], canceled: false};
    const empty = openModal();
    fireEvent.press(empty.getByText("Document"));
    await waitFor(() => expect(getDocumentAsync).toHaveBeenCalledTimes(2));
    expect(empty.files).toHaveLength(0);
  });
});
