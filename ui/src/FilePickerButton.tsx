import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, {useCallback, useState} from "react";

import {Box} from "./Box";
import {Button} from "./Button";
import {IconButton} from "./IconButton";
import {Modal} from "./Modal";

export interface SelectedFile {
  mimeType: string;
  name: string;
  uri: string;
}

export interface FilePickerButtonProps {
  disabled?: boolean;
  multiple?: boolean;
  onFilesSelected: (files: SelectedFile[]) => void;
  testID?: string;
}

export const FilePickerButton = ({
  disabled = false,
  multiple = false,
  onFilesSelected,
  testID,
}: FilePickerButtonProps): React.ReactElement => {
  const [showModal, setShowModal] = useState(false);

  const handlePickImage = useCallback(async () => {
    setShowModal(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: multiple,
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const files: SelectedFile[] = result.assets.map((asset) => ({
        mimeType: asset.mimeType ?? "image/jpeg",
        name: asset.fileName ?? `image-${Date.now()}.jpg`,
        uri: asset.uri,
      }));
      onFilesSelected(files);
    }
  }, [multiple, onFilesSelected]);

  const handlePickDocument = useCallback(async () => {
    setShowModal(false);
    const result = await DocumentPicker.getDocumentAsync({
      multiple,
      type: ["application/pdf", "text/plain", "text/csv", "application/json"],
    });

    if (!result.canceled && result.assets.length > 0) {
      const files: SelectedFile[] = result.assets.map((asset) => ({
        mimeType: asset.mimeType ?? "application/octet-stream",
        name: asset.name,
        uri: asset.uri,
      }));
      onFilesSelected(files);
    }
  }, [multiple, onFilesSelected]);

  return (
    <>
      <IconButton
        accessibilityLabel="Attach file"
        disabled={disabled}
        iconName="paperclip"
        onClick={() => setShowModal(true)}
        testID={testID ?? "file-picker-button"}
      />
      <Modal onDismiss={() => setShowModal(false)} size="sm" title="Attach" visible={showModal}>
        <Box gap={2} padding={3}>
          <Button
            iconName="image"
            onClick={handlePickImage}
            text="Photo Library"
            variant="outline"
          />
          <Button iconName="file" onClick={handlePickDocument} text="Document" variant="outline" />
        </Box>
      </Modal>
    </>
  );
};
