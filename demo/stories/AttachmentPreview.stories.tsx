import {AttachmentPreview, Box, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

const SAMPLE = [
  {mimeType: "image/jpeg", name: "photo.jpg", uri: "https://picsum.photos/seed/att/80/80"},
  {mimeType: "application/pdf", name: "notes.pdf", uri: "file://notes.pdf"},
];

export const AttachmentPreviewDemo: React.FC = (): React.ReactElement => {
  const [attachments, setAttachments] = useState(SAMPLE);
  const onRemove = useCallback((index: number): void => {
    setAttachments((current) => current.filter((_, i) => i !== index));
  }, []);
  if (attachments.length === 0) {
    return <Text>All attachments removed.</Text>;
  }
  return <AttachmentPreview attachments={attachments} onRemove={onRemove} />;
};

export const AttachmentPreviewEmpty: React.FC = (): React.ReactElement => {
  const onRemove = useCallback((): void => {}, []);
  return (
    <Box>
      <AttachmentPreview attachments={[]} onRemove={onRemove} />
      <Text>Empty list renders nothing.</Text>
    </Box>
  );
};
