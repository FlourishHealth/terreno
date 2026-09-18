import React, {useMemo} from "react";
import {Platform} from "react-native";
import WebView from "react-native-webview";

import {Box} from "./Box";
import {toMediaEmbedUrl} from "./markdownEmbeds";

interface MarkdownEmbedProps {
  url: string;
}

export const MarkdownEmbed: React.FC<MarkdownEmbedProps> = ({url}) => {
  const embedUrl = useMemo(() => toMediaEmbedUrl(url), [url]);
  if (!embedUrl) {
    return null;
  }

  if (Platform.OS === "web") {
    return (
      <Box margin={3} testID="markdown-embed-web" width="100%">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          src={embedUrl}
          style={{aspectRatio: "16 / 9", border: 0, borderRadius: 8, width: "100%"}}
          title="Embedded media"
        />
      </Box>
    );
  }

  return (
    <Box height={220} margin={3} testID="markdown-embed-native" width="100%">
      <WebView
        allowsFullscreenVideo
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        source={{uri: embedUrl}}
        style={{borderRadius: 8, flex: 1}}
      />
    </Box>
  );
};
