import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";

export const useDocumentStorageApi = (api: Api<any, any, any, any>, basePath: string) => {
  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        documentStorageDelete: build.mutation({
          invalidatesTags: ["documentStorage"],
          query: (filePath: string) => ({
            method: "DELETE",
            url: `${basePath}/${filePath}`,
          }),
        }),
        documentStorageGetUrl: build.query({
          query: (filePath: string) => ({
            method: "GET",
            url: `${basePath}/url/${filePath}`,
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
    useDeleteMutation: (enhancedApi as any).useDocumentStorageDeleteMutation,
    useGetUrlQuery: (enhancedApi as any).useDocumentStorageGetUrlQuery,
    useLazyGetUrlQuery: (enhancedApi as any).useLazyDocumentStorageGetUrlQuery,
    useListQuery: (enhancedApi as any).useDocumentStorageListQuery,
    useUploadMutation: (enhancedApi as any).useDocumentStorageUploadMutation,
  };
};
