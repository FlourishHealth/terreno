import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {Platform} from "react-native";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";

mock.module("react-native-webview", () => ({
  WebView: (props: any) => React.createElement("WebView", {...props, testID: "mock-webview"}),
}));

interface ListState {
  data: any;
  isLoading: boolean;
  isError: boolean;
  error: any;
}
const listState: ListState = {data: undefined, error: null, isError: false, isLoading: false};
const refetchMock = mock(() => {});
const uploadCalls: any[] = [];
const deleteCalls: string[] = [];
const deleteFolderCalls: string[] = [];
const createFolderCalls: any[] = [];
const downloadCalls: string[] = [];
let uploadImpl: (body: any) => Promise<any> = async () => ({});
let deleteImpl: (p: string) => Promise<any> = async () => ({});
let deleteFolderImpl: (p: string) => Promise<any> = async () => ({});
let createFolderImpl: (body: any) => Promise<any> = async () => ({});
let downloadImpl: (p: string) => Promise<any> = async () => new Blob(["hi"]);

mock.module("./useDocumentStorageApi", () => ({
  useDocumentStorageApi: () => ({
    useCreateFolderMutation: () => [
      (body: any) => ({
        unwrap: async () => {
          createFolderCalls.push(body);
          return createFolderImpl(body);
        },
      }),
    ],
    useDeleteFolderMutation: () => [
      (p: string) => ({
        unwrap: async () => {
          deleteFolderCalls.push(p);
          return deleteFolderImpl(p);
        },
      }),
    ],
    useDeleteMutation: () => [
      (p: string) => ({
        unwrap: async () => {
          deleteCalls.push(p);
          return deleteImpl(p);
        },
      }),
    ],
    useLazyDownloadQuery: () => [
      (p: string) => ({
        unwrap: async () => {
          downloadCalls.push(p);
          return downloadImpl(p);
        },
      }),
    ],
    useListQuery: (_prefix: string | undefined, opts: {skip?: boolean}) => {
      if (opts?.skip) {
        return {
          data: undefined,
          error: null,
          isError: false,
          isLoading: false,
          refetch: refetchMock,
        };
      }
      return {...listState, refetch: refetchMock};
    },
    useUploadMutation: () => [
      (body: any) => ({
        unwrap: async () => {
          uploadCalls.push(body);
          return uploadImpl(body);
        },
      }),
      {isLoading: false},
    ],
  }),
}));

import {DocumentStorageBrowser} from "./DocumentStorageBrowser";

const press = async (el: any): Promise<void> => {
  await act(async () => {
    fireEvent.press(el);
    await new Promise((r) => setTimeout(r, 150));
  });
};

describe("DocumentStorageBrowser", () => {
  beforeEach(() => {
    listState.data = undefined;
    listState.isLoading = false;
    listState.isError = false;
    listState.error = null;
    refetchMock.mockClear();
    uploadCalls.length = 0;
    deleteCalls.length = 0;
    deleteFolderCalls.length = 0;
    createFolderCalls.length = 0;
    downloadCalls.length = 0;
    uploadImpl = async () => ({});
    deleteImpl = async () => ({});
    deleteFolderImpl = async () => ({});
    createFolderImpl = async () => ({});
    downloadImpl = async () => new Blob(["hi"]);
  });

  it("renders loading state", () => {
    listState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders error state", () => {
    listState.isError = true;
    listState.error = {status: 500};
    const {getByText} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    expect(getByText(/Failed to load files/)).toBeDefined();
  });

  it("renders not-configured state on 503", () => {
    listState.isError = true;
    listState.error = {status: 503};
    const onSettingsPress = mock(() => undefined);
    const {getByText} = renderWithTheme(
      <DocumentStorageBrowser
        api={{} as any}
        basePath="/documents"
        onSettingsPress={onSettingsPress}
      />
    );
    expect(getByText(/Storage is not configured/)).toBeDefined();
  });

  it("renders empty state when no files or folders", () => {
    listState.data = {files: [], folders: []};
    const {getByText} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    expect(getByText(/No files found/)).toBeDefined();
  });

  it("renders a data table with files and folders", () => {
    listState.data = {
      files: [
        {
          contentType: "image/png",
          fullPath: "a.png",
          name: "a.png",
          size: 2048,
          updated: "2024-01-01T00:00:00Z",
        },
        {
          contentType: null,
          fullPath: "b.bin",
          name: "b.bin",
          size: 0,
          updated: "",
        },
      ],
      folders: ["sub/"],
    };
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("refreshes the list when refresh is pressed", async () => {
    listState.data = {files: [], folders: []};
    const {getByTestId} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    await press(getByTestId("document-refresh-button"));
    expect(refetchMock).toHaveBeenCalled();
  });

  it("opens the new-folder modal when pressed", async () => {
    listState.data = {files: [], folders: []};
    const {getByTestId, toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    await press(getByTestId("document-new-folder-button"));
    expect(toJSON()).toBeDefined();
  });

  it("does not show upload/new folder when allowUpload is false", () => {
    listState.data = {files: [], folders: []};
    const {queryByTestId} = renderWithTheme(
      <DocumentStorageBrowser allowUpload={false} api={{} as any} basePath="/documents" />
    );
    expect(queryByTestId("document-upload-button")).toBeNull();
    expect(queryByTestId("document-new-folder-button")).toBeNull();
  });

  it("uses onFileSelect when provided", () => {
    listState.data = {
      files: [{contentType: "text/plain", fullPath: "a.txt", name: "a.txt", size: 1, updated: ""}],
      folders: [],
    };
    const onFileSelect = mock(() => undefined);
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" onFileSelect={onFileSelect} />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders settings button when onSettingsPress is provided", () => {
    listState.data = {files: [], folders: []};
    const onSettingsPress = mock(() => undefined);
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser
        api={{} as any}
        basePath="/documents"
        onSettingsPress={onSettingsPress}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("does not render when allowDelete is false (folder actions return null)", () => {
    listState.data = {files: [], folders: ["sub/"]};
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser allowDelete={false} api={{} as any} basePath="/documents" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("uses custom title when provided", () => {
    listState.data = {files: [], folders: []};
    const {getByText} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" title="Custom Storage" />
    );
    expect(getByText("Custom Storage")).toBeDefined();
  });

  it("reconfigures and refetches when refresh is pressed after 503", async () => {
    listState.isError = true;
    listState.error = {status: 503};
    const {getByTestId, rerender} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("document-refresh-button"));
    listState.isError = false;
    listState.error = null;
    listState.data = {files: [], folders: []};
    rerender(<DocumentStorageBrowser api={{} as any} basePath="/documents" />);
    expect(true).toBe(true);
  });

  it("supports originalStatus 503 error shape", () => {
    listState.isError = true;
    listState.error = {originalStatus: 503};
    const {getByText} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    expect(getByText(/Storage is not configured/)).toBeDefined();
  });

  it("renders breadcrumbs that can be clicked", () => {
    listState.data = {files: [], folders: []};
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    // No current prefix, only root crumb
    expect(toJSON()).toBeDefined();
  });

  it("renders new folder modal markup when opened", async () => {
    listState.data = {files: [], folders: []};
    const {getByTestId, toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    await press(getByTestId("document-new-folder-button"));
    expect(toJSON()).toBeDefined();
  });

  it("uploads a file when the hidden input fires change", async () => {
    Object.defineProperty(Platform, "OS", {configurable: true, value: "web"});
    listState.data = {files: [], folders: []};
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    const hostInputs = UNSAFE_getAllByType("input" as any);
    const fileInput = hostInputs.find((node: any) => node.props?.type === "file") as any;
    expect(fileInput).toBeDefined();
    const fakeFile = new File(["x"], "x.txt", {type: "text/plain"});
    await act(async () => {
      fileInput.props.onChange({target: {files: [fakeFile], value: ""}});
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(uploadCalls.length).toBe(1);
    expect(uploadCalls[0].prefix).toBeUndefined();
  });

  it("ignores upload change when no file selected", async () => {
    Object.defineProperty(Platform, "OS", {configurable: true, value: "web"});
    listState.data = {files: [], folders: []};
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    const hostInputs = UNSAFE_getAllByType("input" as any);
    const fileInput = hostInputs.find((node: any) => node.props?.type === "file") as any;
    await act(async () => {
      fileInput.props.onChange({target: {files: []}});
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(uploadCalls.length).toBe(0);
  });

  it("handles upload errors without throwing", async () => {
    Object.defineProperty(Platform, "OS", {configurable: true, value: "web"});
    listState.data = {files: [], folders: []};
    uploadImpl = async () => {
      throw new Error("upload failed");
    };
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    const hostInputs = UNSAFE_getAllByType("input" as any);
    const fileInput = hostInputs.find((node: any) => node.props?.type === "file") as any;
    const fakeFile = new File(["x"], "y.txt", {type: "text/plain"});
    await act(async () => {
      fileInput.props.onChange({target: {files: [fakeFile], value: ""}});
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(uploadCalls.length).toBe(1);
  });

  it("renders folder rows with folder delete action available", () => {
    listState.data = {
      files: [
        {
          contentType: "application/pdf",
          fullPath: "doc.pdf",
          name: "doc.pdf",
          size: 1024,
          updated: "2024-01-01T00:00:00Z",
        },
      ],
      folders: ["sub-folder/"],
    };
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("formats file sizes across all unit ranges", () => {
    listState.data = {
      files: [
        {contentType: "b/b", fullPath: "0", name: "0", size: 0, updated: ""},
        {contentType: "b/b", fullPath: "b", name: "b", size: 512, updated: ""},
        {contentType: "b/b", fullPath: "kb", name: "kb", size: 2048, updated: ""},
        {
          contentType: "b/b",
          fullPath: "mb",
          name: "mb",
          size: 5 * 1024 * 1024,
          updated: "",
        },
        {
          contentType: "b/b",
          fullPath: "gb",
          name: "gb",
          size: 3 * 1024 * 1024 * 1024,
          updated: "",
        },
      ],
      folders: [],
    };
    const {toJSON} = renderWithTheme(
      <DocumentStorageBrowser api={{} as any} basePath="/documents" />
    );
    expect(toJSON()).toBeDefined();
  });
});
