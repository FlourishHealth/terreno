import type {Api} from "@reduxjs/toolkit/query/react";
import {
  Box,
  Button,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  type DataTableCustomComponentMap,
  IconButton,
  Link,
  Page,
  Spinner,
  Text,
} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useCallback, useMemo, useRef, useState} from "react";
import {Platform} from "react-native";

import type {DocumentFile, DocumentListResponse} from "./types";
import {useDocumentStorageApi} from "./useDocumentStorageApi";

interface DocumentStorageBrowserProps {
  api: Api<any, any, any, any>;
  basePath: string;
  title?: string;
  allowDelete?: boolean;
  allowUpload?: boolean;
  onFileSelect?: (file: DocumentFile) => void;
}

const ACTIONS_COLUMN_TYPE = "documentActions";
const NAME_COLUMN_TYPE = "documentName";

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDate = (isoDate: string): string => {
  const dt = DateTime.fromISO(isoDate);
  return dt.isValid ? dt.toLocaleString(DateTime.DATETIME_SHORT) : isoDate;
};

export const DocumentStorageBrowser: React.FC<DocumentStorageBrowserProps> = ({
  api,
  basePath,
  title = "Documents",
  allowDelete = true,
  allowUpload = true,
  onFileSelect,
}) => {
  const [currentPrefix, setCurrentPrefix] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {useListQuery, useUploadMutation, useDeleteMutation, useLazyGetUrlQuery} =
    useDocumentStorageApi(api, basePath);

  const {data: listData, isLoading} = useListQuery(currentPrefix || undefined) as {
    data: DocumentListResponse | undefined;
    isLoading: boolean;
  };
  const [uploadFile, {isLoading: isUploading}] = useUploadMutation();
  const [deleteFile] = useDeleteMutation();
  const [getUrl] = useLazyGetUrlQuery();

  const handleFolderClick = useCallback((folder: string) => {
    setCurrentPrefix(folder);
  }, []);

  const handleBreadcrumbClick = useCallback((prefix: string) => {
    setCurrentPrefix(prefix);
  }, []);

  const handleDownload = useCallback(
    async (filePath: string) => {
      try {
        const result = await getUrl(filePath).unwrap();
        if (Platform.OS === "web" && result?.url) {
          window.open(result.url, "_blank");
        }
      } catch (err) {
        console.error("Failed to get download URL:", err);
      }
    },
    [getUrl]
  );

  const handleDelete = useCallback(
    async (filePath: string) => {
      try {
        await deleteFile(filePath).unwrap();
      } catch (err) {
        console.error("Failed to delete file:", err);
      }
    },
    [deleteFile]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        await uploadFile({formData, prefix: currentPrefix || undefined}).unwrap();
      } catch (err) {
        console.error("Failed to upload file:", err);
      }

      // Reset the input so the same file can be re-uploaded
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [uploadFile, currentPrefix]
  );

  const handleFileClick = useCallback(
    (file: DocumentFile) => {
      if (onFileSelect) {
        onFileSelect(file);
      } else {
        handleDownload(file.fullPath);
      }
    },
    [onFileSelect, handleDownload]
  );

  // Build breadcrumb segments
  const breadcrumbs = useMemo(() => {
    const segments: {label: string; prefix: string}[] = [{label: "Root", prefix: ""}];
    if (currentPrefix) {
      const parts = currentPrefix.split("/").filter(Boolean);
      let accumulated = "";
      for (const part of parts) {
        accumulated += `${part}/`;
        segments.push({label: part, prefix: accumulated});
      }
    }
    return segments;
  }, [currentPrefix]);

  const DocumentNameCell: React.FC<{
    column: DataTableColumn;
    cellData: DataTableCellData;
  }> = useCallback(
    ({cellData}: {column: DataTableColumn; cellData: DataTableCellData}) => {
      const {
        name,
        isFolder: isFolderItem,
        folder,
        file,
      } = cellData.value as {
        name: string;
        isFolder: boolean;
        folder?: string;
        file?: DocumentFile;
      };
      if (isFolderItem && folder) {
        return <Link onClick={() => handleFolderClick(folder)} text={name} />;
      }
      if (file) {
        return <Link onClick={() => handleFileClick(file)} text={name} />;
      }
      return <Text>{name}</Text>;
    },
    [handleFolderClick, handleFileClick]
  );

  const DocumentActionsCell: React.FC<{
    column: DataTableColumn;
    cellData: DataTableCellData;
  }> = useCallback(
    ({cellData}: {column: DataTableColumn; cellData: DataTableCellData}) => {
      const {filePath, isFolder: isFolderItem} = cellData.value as {
        filePath: string;
        isFolder: boolean;
      };
      if (isFolderItem) {
        return null;
      }
      return (
        <Box alignItems="center" direction="row" gap={1} justifyContent="end">
          <IconButton
            accessibilityLabel="Download"
            iconName="download"
            onClick={() => handleDownload(filePath)}
            tooltipText="Download"
            variant="muted"
          />
          {allowDelete && (
            <IconButton
              accessibilityLabel="Delete"
              confirmationText="Are you sure you want to delete this file?"
              iconName="trash"
              onClick={() => handleDelete(filePath)}
              tooltipText="Delete"
              variant="destructive"
              withConfirmation
            />
          )}
        </Box>
      );
    },
    [handleDownload, handleDelete, allowDelete]
  );

  const customColumnComponentMap: DataTableCustomComponentMap = useMemo(
    () => ({
      [ACTIONS_COLUMN_TYPE]: DocumentActionsCell,
      [NAME_COLUMN_TYPE]: DocumentNameCell,
    }),
    [DocumentActionsCell, DocumentNameCell]
  );

  // Build table data from folders + files
  const columns: DataTableColumn[] = useMemo(
    () => [
      {columnType: NAME_COLUMN_TYPE, sortable: false, title: "Name", width: 300},
      {columnType: "text", sortable: false, title: "Size", width: 100},
      {columnType: "text", sortable: false, title: "Type", width: 150},
      {columnType: "text", sortable: false, title: "Updated", width: 180},
      {columnType: ACTIONS_COLUMN_TYPE, sortable: false, title: "", width: 100},
    ],
    []
  );

  const tableData = useMemo(() => {
    const rows: any[][] = [];

    // Add folders first
    for (const folder of listData?.folders ?? []) {
      const folderName = folder.split("/").filter(Boolean).pop() ?? folder;
      rows.push([
        {value: {folder, isFolder: true, name: `${folderName}/`}},
        {value: "\u2014"},
        {value: "Folder"},
        {value: ""},
        {value: {filePath: folder, isFolder: true}},
      ]);
    }

    // Add files
    for (const file of listData?.files ?? []) {
      rows.push([
        {value: {file, isFolder: false, name: file.name}},
        {value: formatFileSize(file.size)},
        {value: file.contentType ?? "Unknown"},
        {value: file.updated ? formatDate(file.updated) : ""},
        {value: {filePath: file.fullPath, isFolder: false}},
      ]);
    }

    return rows;
  }, [listData]);

  return (
    <Page
      footer={
        allowUpload ? (
          <Box direction="row" justifyContent="end" padding={2}>
            {Platform.OS === "web" && (
              <input
                accept="*/*"
                onChange={handleFileChange as any}
                ref={fileInputRef as any}
                style={{display: "none"}}
                type="file"
              />
            )}
            <Button
              loading={isUploading}
              onClick={handleUploadClick}
              testID="document-upload-button"
              text="Upload"
              variant="primary"
            />
          </Box>
        ) : undefined
      }
      maxWidth="100%"
      title={title}
    >
      {/* Breadcrumbs */}
      <Box direction="row" gap={1} padding={2} wrap>
        {breadcrumbs.map((crumb, index) => (
          <Box direction="row" gap={1} key={crumb.prefix || "root"}>
            {index > 0 && <Text color="secondaryDark">/</Text>}
            {index === breadcrumbs.length - 1 ? (
              <Text bold>{crumb.label}</Text>
            ) : (
              <Link onClick={() => handleBreadcrumbClick(crumb.prefix)} text={crumb.label} />
            )}
          </Box>
        ))}
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      ) : tableData.length === 0 ? (
        <Box alignItems="center" padding={6}>
          <Text color="secondaryDark">No files found.</Text>
        </Box>
      ) : (
        <DataTable
          columns={columns}
          customColumnComponentMap={customColumnComponentMap}
          data={tableData}
        />
      )}
    </Page>
  );
};
