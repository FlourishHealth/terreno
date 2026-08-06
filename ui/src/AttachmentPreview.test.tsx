import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {AttachmentPreview} from "./AttachmentPreview";
import type {SelectedFile} from "./FilePickerButton";
import {renderWithTheme} from "./test-utils";

const imageFile: SelectedFile = {
  mimeType: "image/png",
  name: "photo.png",
  uri: "file:///tmp/photo.png",
};

const docFile: SelectedFile = {
  mimeType: "application/pdf",
  name: "report.pdf",
  uri: "file:///tmp/report.pdf",
};

describe("AttachmentPreview", () => {
  it("returns null when there are no attachments", () => {
    const {queryByTestId} = renderWithTheme(
      <AttachmentPreview attachments={[]} onRemove={() => {}} />
    );
    expect(queryByTestId("attachment-preview")).toBeNull();
  });

  it("renders with the default testID", () => {
    const {getByTestId} = renderWithTheme(
      <AttachmentPreview attachments={[docFile]} onRemove={() => {}} />
    );
    expect(getByTestId("attachment-preview")).toBeTruthy();
  });

  it("renders with a custom testID", () => {
    const {getByTestId} = renderWithTheme(
      <AttachmentPreview attachments={[docFile]} onRemove={() => {}} testID="my-preview" />
    );
    expect(getByTestId("my-preview")).toBeTruthy();
  });

  it("renders the attachment name", () => {
    const {getByText} = renderWithTheme(
      <AttachmentPreview attachments={[docFile]} onRemove={() => {}} />
    );
    expect(getByText("report.pdf")).toBeTruthy();
  });

  it("renders an image preview for image mime types", () => {
    const {toJSON} = renderWithTheme(
      <AttachmentPreview attachments={[imageFile]} onRemove={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders a file icon for non-image mime types", () => {
    const {toJSON} = renderWithTheme(
      <AttachmentPreview attachments={[docFile]} onRemove={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders multiple attachments", () => {
    const {getByText} = renderWithTheme(
      <AttachmentPreview attachments={[imageFile, docFile]} onRemove={() => {}} />
    );
    expect(getByText("photo.png")).toBeTruthy();
    expect(getByText("report.pdf")).toBeTruthy();
  });

  it("calls onRemove with the attachment index when dismissed", () => {
    const onRemove = mock(() => {});
    const {getByLabelText} = renderWithTheme(
      <AttachmentPreview attachments={[imageFile, docFile]} onRemove={onRemove} />
    );
    fireEvent.press(getByLabelText("Remove report.pdf"));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
