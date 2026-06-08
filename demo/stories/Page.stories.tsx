import {Box, Page, type PageProps} from "@terreno/ui";
import React from "react";

export const PageDemo = (props: Partial<PageProps> & {preview?: boolean}): React.ReactElement => {
  if (props.preview) {
    return <Box />;
  }

  const {preview: _preview, ...pageProps} = props;
  return <Page title="Page Title" {...pageProps} />;
};

export const PageLoadingBoolean = (): React.ReactElement => {
  return <Page loading={true} title="Loading Page" />;
};

export const PageLoadingText = (): React.ReactElement => {
  return <Page loading={true} loadingText="Fetching your data..." title="Loading with Text" />;
};
