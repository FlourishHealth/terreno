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
          query: (filePath: string) => ({
            method: "GET",
            responseHandler: (response: Response) => response.blob(),
            url: `${basePath}/download/${encodeURIComponent(filePath)}`,
          }),
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
