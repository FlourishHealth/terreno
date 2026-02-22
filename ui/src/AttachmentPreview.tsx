import React from "react";
import {Image as RNImage} from "react-native";

import {Box} from "./Box";
import {DismissButton} from "./DismissButton";
import type {SelectedFile} from "./FilePickerButton";
import {Icon} from "./Icon";
import {Text} from "./Text";

export interface AttachmentPreviewProps {
  attachments: SelectedFile[];
  onRemove: (index: number) => void;
  testID?: string;
}

const isImageMimeType = (mimeType: string): boolean => {
  return mimeType.startsWith("image/");
};

export const AttachmentPreview = ({
  attachments,
  onRemove,
  testID,
}: AttachmentPreviewProps): React.ReactElement | null => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <Box direction="row" gap={2} padding={2} testID={testID ?? "attachment-preview"} wrap>
      {attachments.map((attachment, index) => (
        <Box
          alignItems="center"
          border="default"
          direction="row"
          gap={1}
          key={`attachment-${index}`}
          padding={1}
          rounding="md"
        >
          {isImageMimeType(attachment.mimeType) ? (
            <RNImage
              source={{uri: attachment.uri}}
              style={{borderRadius: 4, height: 40, width: 40}}
            />
          ) : (
            <Box alignItems="center" justifyContent="center" padding={1}>
              <Icon iconName="file" size="sm" />
            </Box>
          )}
          <Text size="sm" truncate>
            {attachment.name}
          </Text>
          <DismissButton
            accessibilityHint="Removes this attachment"
            accessibilityLabel={`Remove ${attachment.name}`}
            onClick={() => onRemove(index)}
          />
        </Box>
      ))}
    </Box>
  );
};
