import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";

export const useDocumentStorageApi = (api: Api<any, any, any, any>, basePath: string) => {
  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        documentStorageCreateFolder: build.mutation({
          invalidatesTags: ["documentStorage"],
          query: ({folderName, prefix}: {folderName: string; prefix?: string}) => ({
            body: {folderName, prefix},
            method: "POST",
            url: `${basePath}/folder`,
          }),
        }),
        documentStorageDelete: build.mutation({
          invalidatesTags: ["documentStorage"],
          query: (filePath: string) => ({
            method: "DELETE",
            url: `${basePath}/${encodeURIComponent(filePath)}`,
          }),
        }),
        documentStorageDeleteFolder: build.mutation({
          invalidatesTags: ["documentStorage"],
          query: (folderPath: string) => ({
            method: "DELETE",
            url: `${basePath}/folder/${encodeURIComponent(folderPath)}`,
          }),
        }),
        documentStorageDownload: build.query({
          extraOptions: {maxRetries: 0},
          query: (filePath: string) => {
            const url = `${basePath}/download/${encodeURIComponent(filePath)}`;
            console.info("[documentStorage] download url:", url, "filePath:", filePath);
            return {
              method: "GET",
              responseHandler: async (response: Response) => {
                console.info(
                  "[documentStorage] download response:",
                  response.status,
                  response.statusText,
                  "content-type:",
                  response.headers.get("content-type")
                );
                if (response.ok) {
                  const blob = await response.blob();
                  console.info("[documentStorage] blob size:", blob.size, "type:", blob.type);
                  return blob;
                }
                const text = await response.text();
                console.error("[documentStorage] error response body:", text);
                try {
                  return JSON.parse(text);
                } catch {
                  return {detail: text, status: response.status};
                }
              },
              url,
            };
          },
        }),
        documentStorageList: build.query({
          providesTags: ["documentStorage"],
          query: (prefix?: string) => ({
            method: "GET",
            params: prefix ? {prefix} : {},
            url: `${basePath}/`,
          }),
        }),
        documentStorageUpload: build.mutation({
          invalidatesTags: ["documentStorage"],
          query: ({formData, prefix}: {formData: FormData; prefix?: string}) => {
            if (prefix) {
              formData.append("prefix", prefix);
            }
            return {
              body: formData,
              method: "POST",
              url: `${basePath}/`,
            };
          },
        }),
      }),
      overrideExisting: false,
    });
  }, [api, basePath]);

  return {
    useCreateFolderMutation: (enhancedApi as any).useDocumentStorageCreateFolderMutation,
    useDeleteFolderMutation: (enhancedApi as any).useDocumentStorageDeleteFolderMutation,
    useDeleteMutation: (enhancedApi as any).useDocumentStorageDeleteMutation,
    useLazyDownloadQuery: (enhancedApi as any).useLazyDocumentStorageDownloadQuery,
    useListQuery: (enhancedApi as any).useDocumentStorageListQuery,
    useUploadMutation: (enhancedApi as any).useDocumentStorageUploadMutation,
  };
};
