import {
  Box,
  Button,
  DataTable,
  type DataTableCellData,
  type DataTableColumn,
  type DataTableCustomComponentMap,
  IconButton,
  Link,
  Modal,
  Page,
  Spinner,
  Text,
  TextField,
} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Platform} from "react-native";

import type {DocumentFile, DocumentListResponse, DocumentStorageBrowserProps} from "./types";
import {useDocumentStorageApi} from "./useDocumentStorageApi";

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

// ---------------------------------------------------------------------------
// Module-level cell components (callbacks passed through cellData.value)
// ---------------------------------------------------------------------------

const DocumentNameCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {name, isFolder, folder, file, onFolderClick, onFileClick} = cellData.value as {
    name: string;
    isFolder: boolean;
    folder?: string;
    file?: DocumentFile;
    onFolderClick: (folder: string) => void;
    onFileClick: (file: DocumentFile) => void;
  };
  if (isFolder && folder) {
    return <Link onClick={() => onFolderClick(folder)} text={name} />;
  }
  if (file) {
    return <Link onClick={() => onFileClick(file)} text={name} />;
  }
  return <Text>{name}</Text>;
};

const DocumentActionsCell: React.FC<{column: DataTableColumn; cellData: DataTableCellData}> = ({
  cellData,
}) => {
  const {filePath, isFolder, allowDelete, onDownload, onDelete, onDeleteFolder} =
    cellData.value as {
      filePath: string;
      isFolder: boolean;
      allowDelete: boolean;
      onDownload: (path: string) => void;
      onDelete: (path: string) => void;
      onDeleteFolder: (path: string) => void;
    };

  if (isFolder) {
    if (!allowDelete) {
      return null;
    }
    return (
      <Box alignItems="center" direction="row" gap={1} justifyContent="end">
        <IconButton
          accessibilityLabel="Delete folder"
          confirmationText="Delete this folder and all its contents?"
          iconName="trash"
          onClick={() => onDeleteFolder(filePath)}
          tooltipText="Delete folder"
          variant="destructive"
          withConfirmation
        />
      </Box>
    );
  }

  return (
    <Box alignItems="center" direction="row" gap={1} justifyContent="end">
      <IconButton
        accessibilityLabel="Download"
        iconName="download"
        onClick={() => onDownload(filePath)}
        tooltipText="Download"
        variant="muted"
      />
      {allowDelete && (
        <IconButton
          accessibilityLabel="Delete"
          confirmationText="Are you sure you want to delete this file?"
          iconName="trash"
          onClick={() => onDelete(filePath)}
          tooltipText="Delete"
          variant="destructive"
          withConfirmation
        />
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Sub-components for the header bar
// ---------------------------------------------------------------------------

const BreadcrumbItem: React.FC<{
  label: string;
  prefix: string;
  isLast: boolean;
  showSeparator: boolean;
  onPress: (prefix: string) => void;
}> = ({label, prefix, isLast, showSeparator, onPress}) => (
  <Box direction="row" gap={1}>
    {showSeparator && <Text color="secondaryDark">/</Text>}
    {isLast ? <Text bold>{label}</Text> : <Link onClick={() => onPress(prefix)} text={label} />}
  </Box>
);

const UploadButton: React.FC<{
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadClick: () => void;
}> = ({isUploading, fileInputRef, onFileChange, onUploadClick}) => (
  <>
    <input
      accept="*/*"
      onChange={onFileChange as any}
      ref={fileInputRef as any}
      style={{display: "none"}}
      type="file"
    />
    <IconButton
      accessibilityLabel="Upload file"
      iconName="cloud-arrow-up"
      loading={isUploading}
      onClick={onUploadClick}
      testID="document-upload-button"
      tooltipText="Upload file"
      variant="muted"
    />
  </>
);

const SettingsButton: React.FC<{onPress: () => void}> = ({onPress}) => (
  <IconButton
    accessibilityLabel="Storage settings"
    iconName="gear"
    onClick={onPress}
    variant="muted"
  />
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const DocumentStorageBrowser: React.FC<DocumentStorageBrowserProps> = ({
  api,
  basePath,
  title = "Documents",
  allowDelete = true,
  allowUpload = true,
  onFileSelect,
  onSettingsPress,
}) => {
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [isNotConfigured, setIsNotConfigured] = useState(false);
  const [skipFetch, setSkipFetch] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    useListQuery,
    useUploadMutation,
    useDeleteMutation,
    useDeleteFolderMutation,
    useCreateFolderMutation,
    useLazyDownloadQuery,
  } = useDocumentStorageApi(api, basePath);

  const {
    data: listData,
    isLoading,
    isError,
    error,
    refetch,
  } = useListQuery(currentPrefix || undefined, {skip: skipFetch}) as {
    data: DocumentListResponse | undefined;
    isLoading: boolean;
    isError: boolean;
    error: any;
    refetch: () => void;
  };
  const [uploadFile, {isLoading: isUploading}] = useUploadMutation();
  const [deleteFile] = useDeleteMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const [createFolder] = useCreateFolderMutation();
  const [downloadFile] = useLazyDownloadQuery();

  useEffect(() => {
    if (isError && error) {
      const status = error?.status ?? error?.originalStatus;
      if (status === 503) {
        setIsNotConfigured(true);
        setSkipFetch(true);
      }
    }
  }, [isError, error]);

  const handleRefresh = useCallback(() => {
    if (skipFetch) {
      setIsNotConfigured(false);
      setSkipFetch(false);
    } else {
      refetch();
    }
  }, [skipFetch, refetch]);

  const handleFolderClick = useCallback((folder: string) => {
    setCurrentPrefix(folder);
  }, []);

  const handleBreadcrumbClick = useCallback((prefix: string) => {
    setCurrentPrefix(prefix);
  }, []);

  const handleDownload = useCallback(
    async (filePath: string) => {
      try {
        const blob = await downloadFile(filePath).unwrap();
        if (Platform.OS === "web" && blob) {
          const url = URL.createObjectURL(blob as Blob);
          const filename = filePath.split("/").filter(Boolean).pop() ?? "download";
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error("Failed to download file:", err);
      }
    },
    [downloadFile]
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

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      try {
        await deleteFolder(folderPath).unwrap();
      } catch (err) {
        console.error("Failed to delete folder:", err);
      }
    },
    [deleteFolder]
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

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) {
      return;
    }
    setIsCreatingFolder(true);
    try {
      await createFolder({folderName: name, prefix: currentPrefix || undefined}).unwrap();
      setNewFolderName("");
      setShowNewFolderModal(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    } finally {
      setIsCreatingFolder(false);
    }
  }, [createFolder, newFolderName, currentPrefix]);

  const handleNewFolderModalDismiss = useCallback(() => {
    setShowNewFolderModal(false);
    setNewFolderName("");
  }, []);

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

  const customColumnComponentMap: DataTableCustomComponentMap = useMemo(
    () => ({
      [ACTIONS_COLUMN_TYPE]: DocumentActionsCell,
      [NAME_COLUMN_TYPE]: DocumentNameCell,
    }),
    []
  );

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

    for (const folder of listData?.folders ?? []) {
      const folderName = folder.split("/").filter(Boolean).pop() ?? folder;
      rows.push([
        {
          value: {
            folder,
            isFolder: true,
            name: `${folderName}/`,
            onFileClick: handleFileClick,
            onFolderClick: handleFolderClick,
          },
        },
        {value: "\u2014"},
        {value: "Folder"},
        {value: ""},
        {
          value: {
            allowDelete,
            filePath: folder,
            isFolder: true,
            onDelete: handleDelete,
            onDeleteFolder: handleDeleteFolder,
            onDownload: handleDownload,
          },
        },
      ]);
    }

    for (const file of listData?.files ?? []) {
      rows.push([
        {
          value: {
            file,
            isFolder: false,
            name: file.name,
            onFileClick: handleFileClick,
            onFolderClick: handleFolderClick,
          },
        },
        {value: formatFileSize(file.size)},
        {value: file.contentType ?? "Unknown"},
        {value: file.updated ? formatDate(file.updated) : ""},
        {
          value: {
            allowDelete,
            filePath: file.fullPath,
            isFolder: false,
            onDelete: handleDelete,
            onDeleteFolder: handleDeleteFolder,
            onDownload: handleDownload,
          },
        },
      ]);
    }

    return rows;
  }, [
    listData,
    allowDelete,
    handleDelete,
    handleDeleteFolder,
    handleDownload,
    handleFileClick,
    handleFolderClick,
  ]);

  const renderContent = () => {
    if (isNotConfigured) {
      return (
        <Box alignItems="center" gap={3} padding={6}>
          <Text color="error">Storage is not configured.</Text>
          {onSettingsPress && (
            <Button
              iconName="gear"
              onClick={onSettingsPress}
              text="Open Settings"
              variant="secondary"
            />
          )}
        </Box>
      );
    }
    if (isLoading) {
      return (
        <Box alignItems="center" justifyContent="center" padding={6}>
          <Spinner />
        </Box>
      );
    }
    if (isError) {
      return (
        <Box alignItems="center" padding={6}>
          <Text color="error">Failed to load files. Please try again.</Text>
        </Box>
      );
    }
    if (tableData.length === 0) {
      return (
        <Box alignItems="center" padding={6}>
          <Text color="secondaryDark">No files found.</Text>
        </Box>
      );
    }
    return (
      <DataTable
        columns={columns}
        customColumnComponentMap={customColumnComponentMap}
        data={tableData}
      />
    );
  };

  const headerRow = (
    <Box alignItems="center" direction="row" padding={2}>
      <Box alignItems="center" direction="row" flex="grow" gap={1} wrap>
        {breadcrumbs.map((crumb, index) => (
          <BreadcrumbItem
            isLast={index === breadcrumbs.length - 1}
            key={crumb.prefix || "root"}
            label={crumb.label}
            onPress={handleBreadcrumbClick}
            prefix={crumb.prefix}
            showSeparator={index > 0}
          />
        ))}
      </Box>
      <Box alignItems="center" direction="row" gap={1}>
        {Platform.OS === "web" && allowUpload && (
          <UploadButton
            fileInputRef={fileInputRef}
            isUploading={isUploading}
            onFileChange={handleFileChange}
            onUploadClick={handleUploadClick}
          />
        )}
        {allowUpload && (
          <IconButton
            accessibilityLabel="New folder"
            iconName="folder-plus"
            onClick={() => setShowNewFolderModal(true)}
            testID="document-new-folder-button"
            tooltipText="New folder"
            variant="muted"
          />
        )}
        <IconButton
          accessibilityLabel="Refresh"
          iconName="rotate"
          onClick={handleRefresh}
          testID="document-refresh-button"
          tooltipText="Refresh"
          variant="muted"
        />
        {onSettingsPress && <SettingsButton onPress={onSettingsPress} />}
      </Box>
    </Box>
  );

  return (
    <Page maxWidth="100%" title={title}>
      {headerRow}
      {renderContent()}

      <Modal
        onDismiss={handleNewFolderModalDismiss}
        primaryButtonOnClick={handleCreateFolder}
        primaryButtonText="Create"
        secondaryButtonOnClick={handleNewFolderModalDismiss}
        secondaryButtonText="Cancel"
        size="sm"
        title="New Folder"
        visible={showNewFolderModal}
      >
        <Box gap={3}>
          <TextField
            disabled={isCreatingFolder}
            onChange={setNewFolderName}
            placeholder="folder-name"
            testID="new-folder-name-input"
            title="Folder Name"
            value={newFolderName}
          />
        </Box>
      </Modal>
    </Page>
  );
};
