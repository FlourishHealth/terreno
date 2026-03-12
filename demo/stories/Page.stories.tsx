import {Page, type PageProps} from "@terreno/ui";
import React from "react";

export const PageDemo = (props: Partial<PageProps>): React.ReactElement => {
  return <Page title="Page Title" {...props} />;
};

export const PageLoadingBoolean = (): React.ReactElement => {
  return <Page loading={true} title="Loading Page" />;
};

export const PageLoadingText = (): React.ReactElement => {
  return <Page loading={true} loadingText="Fetching your data..." title="Loading with Text" />;
};
