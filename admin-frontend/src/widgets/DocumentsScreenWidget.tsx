import React from "react";
import {DocumentStorageBrowser} from "../DocumentStorageBrowser";
import type {AdminScreenWidgetProps, ScreenWidgetComponent} from "../types";

export const DocumentsScreenWidget: React.FC<AdminScreenWidgetProps> = ({api, routeBase}) => {
  return (
    <DocumentStorageBrowser
      api={api}
      backHref={routeBase}
      basePath="/documents"
      title="Documents"
    />
  );
};

export const DOCUMENT_STORAGE_ADMIN_WIDGETS: Record<string, ScreenWidgetComponent> = {
  documents: DocumentsScreenWidget,
};
