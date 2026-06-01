import {emptySplitApi as api} from "@terreno/rtk";
export const addTagTypes = [
  "users",
  "gpt",
  "admin",
  "admin-users",
  "settings",
  "todos",
  "featureflags",
  "consentforms",
  "consentresponses",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      $get: build.query<$getRes, $getArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            email: queryArg.email,
            limit: queryArg.limit,
            name: queryArg.name,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/`,
        }),
      }),
      deleteAdminConsentFormsById: build.mutation<
        DeleteAdminConsentFormsByIdRes,
        DeleteAdminConsentFormsByIdArgs
      >({
        invalidatesTags: ["consentforms"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/consent-forms/${queryArg}`,
        }),
      }),
      deleteAdminConsentResponsesById: build.mutation<
        DeleteAdminConsentResponsesByIdRes,
        DeleteAdminConsentResponsesByIdArgs
      >({
        invalidatesTags: ["consentresponses"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/consent-responses/${queryArg}`,
        }),
      }),
      deleteAdminFeatureFlagsById: build.mutation<
        DeleteAdminFeatureFlagsByIdRes,
        DeleteAdminFeatureFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/feature-flags/${queryArg}`,
        }),
      }),
      deleteAdminTodosById: build.mutation<DeleteAdminTodosByIdRes, DeleteAdminTodosByIdArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/todos/${queryArg}`,
        }),
      }),
      deleteAdminUsersById: build.mutation<DeleteAdminUsersByIdRes, DeleteAdminUsersByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/admin/users/${queryArg}`,
        }),
      }),
      deleteById: build.mutation<DeleteByIdRes, DeleteByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({method: "DELETE", url: `/${queryArg}`}),
      }),
      deleteFeatureFlagsFlagsById: build.mutation<
        DeleteFeatureFlagsFlagsByIdRes,
        DeleteFeatureFlagsFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/feature-flags/flags/${queryArg}`,
        }),
      }),
      deleteSettingsGcs: build.mutation<DeleteSettingsGcsRes, DeleteSettingsGcsArgs>({
        invalidatesTags: ["settings"],
        query: () => ({method: "DELETE", url: `/settings/gcs`}),
      }),
      deleteTodosById: build.mutation<DeleteTodosByIdRes, DeleteTodosByIdArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({method: "DELETE", url: `/todos/${queryArg}`}),
      }),
      getAdminConsentForms: build.query<GetAdminConsentFormsRes, GetAdminConsentFormsArgs>({
        providesTags: ["consentforms"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/admin/consent-forms/`,
        }),
      }),
      getAdminConsentFormsById: build.query<
        GetAdminConsentFormsByIdRes,
        GetAdminConsentFormsByIdArgs
      >({
        providesTags: ["consentforms"],
        query: (queryArg) => ({url: `/admin/consent-forms/${queryArg}`}),
      }),
      getAdminConsentResponses: build.query<
        GetAdminConsentResponsesRes,
        GetAdminConsentResponsesArgs
      >({
        providesTags: ["consentresponses"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/admin/consent-responses/`,
        }),
      }),
      getAdminConsentResponsesById: build.query<
        GetAdminConsentResponsesByIdRes,
        GetAdminConsentResponsesByIdArgs
      >({
        providesTags: ["consentresponses"],
        query: (queryArg) => ({url: `/admin/consent-responses/${queryArg}`}),
      }),
      getAdminFeatureFlags: build.query<GetAdminFeatureFlagsRes, GetAdminFeatureFlagsArgs>({
        providesTags: ["featureflags"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/admin/feature-flags/`,
        }),
      }),
      getAdminFeatureFlagsById: build.query<
        GetAdminFeatureFlagsByIdRes,
        GetAdminFeatureFlagsByIdArgs
      >({
        providesTags: ["featureflags"],
        query: (queryArg) => ({url: `/admin/feature-flags/${queryArg}`}),
      }),
      getAdminTodos: build.query<GetAdminTodosRes, GetAdminTodosArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/admin/todos/`,
        }),
      }),
      getAdminTodosById: build.query<GetAdminTodosByIdRes, GetAdminTodosByIdArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({url: `/admin/todos/${queryArg}`}),
      }),
      getAdminUsers: build.query<GetAdminUsersRes, GetAdminUsersArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/admin/users/`,
        }),
      }),
      getAdminUsersById: build.query<GetAdminUsersByIdRes, GetAdminUsersByIdArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({url: `/admin/users/${queryArg}`}),
      }),
      getAiRequestsExplorer: build.query<GetAiRequestsExplorerRes, GetAiRequestsExplorerArgs>({
        providesTags: ["admin"],
        query: (queryArg) => ({
          params: {
            endDate: queryArg.endDate,
            limit: queryArg.limit,
            model: queryArg.model,
            page: queryArg.page,
            requestType: queryArg.requestType,
            startDate: queryArg.startDate,
          },
          url: `/aiRequestsExplorer`,
        }),
      }),
      getById: build.query<GetByIdRes, GetByIdArgs>({
        providesTags: ["users"],
        query: (queryArg) => ({url: `/${queryArg}`}),
      }),
      getFeatureFlagsFlags: build.query<GetFeatureFlagsFlagsRes, GetFeatureFlagsFlagsArgs>({
        providesTags: ["featureflags"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/feature-flags/flags/`,
        }),
      }),
      getFeatureFlagsFlagsById: build.query<
        GetFeatureFlagsFlagsByIdRes,
        GetFeatureFlagsFlagsByIdArgs
      >({
        providesTags: ["featureflags"],
        query: (queryArg) => ({url: `/feature-flags/flags/${queryArg}`}),
      }),
      getGptTools: build.query<GetGptToolsRes, GetGptToolsArgs>({
        providesTags: ["gpt"],
        query: () => ({url: `/gpt/tools`}),
      }),
      getSettingsGcs: build.query<GetSettingsGcsRes, GetSettingsGcsArgs>({
        providesTags: ["settings"],
        query: () => ({url: `/settings/gcs`}),
      }),
      getTodos: build.query<GetTodosRes, GetTodosArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({
          params: {
            _id: queryArg._id,
            completed: queryArg.completed,
            limit: queryArg.limit,
            ownerId: queryArg.ownerId,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: `/todos/`,
        }),
      }),
      getTodosById: build.query<GetTodosByIdRes, GetTodosByIdArgs>({
        providesTags: ["todos"],
        query: (queryArg) => ({url: `/todos/${queryArg}`}),
      }),
      patchAdminConsentFormsById: build.mutation<
        PatchAdminConsentFormsByIdRes,
        PatchAdminConsentFormsByIdArgs
      >({
        invalidatesTags: ["consentforms"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/consent-forms/${queryArg.id}`,
        }),
      }),
      patchAdminConsentResponsesById: build.mutation<
        PatchAdminConsentResponsesByIdRes,
        PatchAdminConsentResponsesByIdArgs
      >({
        invalidatesTags: ["consentresponses"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/consent-responses/${queryArg.id}`,
        }),
      }),
      patchAdminFeatureFlagsById: build.mutation<
        PatchAdminFeatureFlagsByIdRes,
        PatchAdminFeatureFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/feature-flags/${queryArg.id}`,
        }),
      }),
      patchAdminTodosById: build.mutation<PatchAdminTodosByIdRes, PatchAdminTodosByIdArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/todos/${queryArg.id}`,
        }),
      }),
      patchAdminUsersById: build.mutation<PatchAdminUsersByIdRes, PatchAdminUsersByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/admin/users/${queryArg.id}`,
        }),
      }),
      patchById: build.mutation<PatchByIdRes, PatchByIdArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/${queryArg.id}`,
        }),
      }),
      patchFeatureFlagsFlagsById: build.mutation<
        PatchFeatureFlagsFlagsByIdRes,
        PatchFeatureFlagsFlagsByIdArgs
      >({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/feature-flags/flags/${queryArg.id}`,
        }),
      }),
      patchGptHistoriesByIdRating: build.mutation<
        PatchGptHistoriesByIdRatingRes,
        PatchGptHistoriesByIdRatingArgs
      >({
        invalidatesTags: ["gpt"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/gpt/histories/${queryArg.id}/rating`,
        }),
      }),
      patchTodosById: build.mutation<PatchTodosByIdRes, PatchTodosByIdArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/todos/${queryArg.id}`,
        }),
      }),
      post: build.mutation<PostRes, PostArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({body: queryArg, method: "POST", url: `/`}),
      }),
      postAdminConsentForms: build.mutation<PostAdminConsentFormsRes, PostAdminConsentFormsArgs>({
        invalidatesTags: ["consentforms"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/consent-forms/`,
        }),
      }),
      postAdminConsentResponses: build.mutation<
        PostAdminConsentResponsesRes,
        PostAdminConsentResponsesArgs
      >({
        invalidatesTags: ["consentresponses"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/consent-responses/`,
        }),
      }),
      postAdminFeatureFlags: build.mutation<PostAdminFeatureFlagsRes, PostAdminFeatureFlagsArgs>({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/feature-flags/`,
        }),
      }),
      postAdminTodos: build.mutation<PostAdminTodosRes, PostAdminTodosArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/todos/`,
        }),
      }),
      postAdminUsers: build.mutation<PostAdminUsersRes, PostAdminUsersArgs>({
        invalidatesTags: ["users"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/admin/users/`,
        }),
      }),
      postAdminUsersByIdPassword: build.mutation<
        PostAdminUsersByIdPasswordRes,
        PostAdminUsersByIdPasswordArgs
      >({
        invalidatesTags: ["admin-users"],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "POST",
          url: `/admin/users/${queryArg.id}/password`,
        }),
      }),
      postFeatureFlagsFlags: build.mutation<PostFeatureFlagsFlagsRes, PostFeatureFlagsFlagsArgs>({
        invalidatesTags: ["featureflags"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/feature-flags/flags/`,
        }),
      }),
      postGptPrompt: build.mutation<PostGptPromptRes, PostGptPromptArgs>({
        invalidatesTags: ["gpt"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/gpt/prompt`,
        }),
      }),
      postGptRemix: build.mutation<PostGptRemixRes, PostGptRemixArgs>({
        invalidatesTags: ["gpt"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/gpt/remix`,
        }),
      }),
      postSettingsGcs: build.mutation<PostSettingsGcsRes, PostSettingsGcsArgs>({
        invalidatesTags: ["settings"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/settings/gcs`,
        }),
      }),
      postTodos: build.mutation<PostTodosRes, PostTodosArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/todos/`,
        }),
      }),
      todosBulkComplete: build.mutation<TodosBulkCompleteRes, TodosBulkCompleteArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: `/todos/bulkComplete`,
        }),
      }),
      todosMarkComplete: build.mutation<TodosMarkCompleteRes, TodosMarkCompleteArgs>({
        invalidatesTags: ["todos"],
        query: (queryArg) => ({
          method: "POST",
          url: `/todos/${queryArg}/markComplete`,
        }),
      }),
    }),
    overrideExisting: false,
  });

export {injectedRtkApi as openapi};
export type PostRes = /** status 201 Successful create */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostArgs = {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email?: string;
  /** The user's display name */
  name?: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id?: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type $getRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email: string;
    /** The user's display name */
    name: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    _id: string;
    hash?: string;
    salt?: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type $getArgs = {
  _id?: {
    $in?: string[];
  };
  email?:
    | string
    | {
        $in?: string[];
      };
  name?:
    | string
    | {
        $in?: string[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetByIdRes = /** status 200 Successful read */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetByIdArgs = string;
export type PatchByIdRes = /** status 200 Successful update */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchByIdArgs = {
  id: string;
  body: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email?: string;
    /** The user's display name */
    name?: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    _id?: string;
    hash?: string;
    salt?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteByIdRes = unknown;
export type DeleteByIdArgs = string;
export type PostGptPromptRes = /** status 200 Success */ {
  data?: string;
};
export type PostGptPromptArgs = {
  attachments?: {
    filename?: string;
    mimeType?: string;
    type?: string;
    url?: string;
  }[];
  historyId?: string;
  model?: string;
  projectId?: string;
  prompt?: string;
  systemPrompt?: string;
};
export type PatchGptHistoriesByIdRatingRes = /** status 200 Success */ {
  data?: object;
};
export type PatchGptHistoriesByIdRatingArgs = {
  id: string;
  body: {
    promptIndex?: number;
    rating?: string;
  };
};
export type PostGptRemixRes = /** status 200 Success */ {
  data?: string;
};
export type PostGptRemixArgs = {
  text?: string;
};
export type GetGptToolsRes = /** status 200 Success */ {
  data?: {
    description?: string;
    name?: string;
    source?: string;
  }[];
};
export type GetGptToolsArgs = void;
export type GetAiRequestsExplorerRes = /** status 200 Success */ {
  data?: object[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAiRequestsExplorerArgs = {
  page?: number;
  limit?: number;
  requestType?: string;
  model?: string;
  startDate?: string;
  endDate?: string;
};
export type PostAdminUsersByIdPasswordRes = /** status 200 Success */ {
  data?: {
    _id?: string;
    message?: string;
  };
};
export type PostAdminUsersByIdPasswordArgs = {
  id: string;
  body: {
    /** New password for the user */
    password?: string;
  };
};
export type GetSettingsGcsRes = /** status 200 Success */ {
  data?: {
    bucketName?: string;
    configured?: boolean;
    hasCredentials?: boolean;
    projectId?: string;
  };
};
export type GetSettingsGcsArgs = void;
export type PostSettingsGcsRes = /** status 200 Success */ {
  data?: {
    configured?: boolean;
    message?: string;
  };
};
export type PostSettingsGcsArgs = {
  bucketName?: string;
  projectId?: string;
  serviceAccountKey?: string;
};
export type DeleteSettingsGcsRes = /** status 200 Success */ {
  data?: {
    configured?: boolean;
    message?: string;
  };
};
export type DeleteSettingsGcsArgs = void;
export type TodosMarkCompleteRes = /** status 200 Successful response */ {
  data?: object;
};
export type TodosMarkCompleteArgs = string;
export type TodosBulkCompleteRes = /** status 200 Successful response */ {
  data: {
    matched: number;
    modified: number;
  };
};
export type TodosBulkCompleteArgs = {
  ids: string[];
};
export type PostTodosRes = /** status 201 Successful create */ {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostTodosArgs = {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId?: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title?: string;
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetTodosRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId: any;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title: string;
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetTodosArgs = {
  _id?: {
    $in?: string[];
  };
  completed?:
    | boolean
    | {
        $in?: boolean[];
      };
  ownerId?:
    | any
    | {
        $in?: any[];
      };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetTodosByIdRes = /** status 200 Successful read */ {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetTodosByIdArgs = string;
export type PatchTodosByIdRes = /** status 200 Successful update */ {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchTodosByIdArgs = {
  id: string;
  body: {
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId?: any;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title?: string;
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteTodosByIdRes = unknown;
export type DeleteTodosByIdArgs = string;
export type PostFeatureFlagsFlagsRes = /** status 201 Successful create */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostFeatureFlagsFlagsArgs = {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key?: string;
  /** Human-readable display name */
  name?: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetFeatureFlagsFlagsRes = /** status 200 Successful list */ {
  data?: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key: string;
    /** Human-readable display name */
    name: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
    }[];
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetFeatureFlagsFlagsArgs = {
  _id?: {
    $in?: string[];
  };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetFeatureFlagsFlagsByIdRes = /** status 200 Successful read */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetFeatureFlagsFlagsByIdArgs = string;
export type PatchFeatureFlagsFlagsByIdRes = /** status 200 Successful update */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchFeatureFlagsFlagsByIdArgs = {
  id: string;
  body: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key?: string;
    /** Human-readable display name */
    name?: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
    }[];
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteFeatureFlagsFlagsByIdRes = unknown;
export type DeleteFeatureFlagsFlagsByIdArgs = string;
export type PostAdminFeatureFlagsRes = /** status 201 Successful create */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminFeatureFlagsArgs = {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key?: string;
  /** Human-readable display name */
  name?: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminFeatureFlagsRes = /** status 200 Successful list */ {
  data?: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key: string;
    /** Human-readable display name */
    name: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
    }[];
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminFeatureFlagsArgs = {
  _id?: {
    $in?: string[];
  };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminFeatureFlagsByIdRes = /** status 200 Successful read */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminFeatureFlagsByIdArgs = string;
export type PatchAdminFeatureFlagsByIdRes = /** status 200 Successful update */ {
  /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
  archived?: boolean;
  /** Explanation of what this flag controls */
  description?: string;
  /** Global kill switch — if false, flag is off for everyone */
  enabled?: boolean;
  /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
  key: string;
  /** Human-readable display name */
  name: string;
  /** For boolean flags with no matching rules: percentage of users who get true */
  rolloutPercentage?: number;
  rules?: {
    /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
    enabled?: boolean;
    /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
    field?: string;
    /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
    operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
    /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
    segment?: string;
    /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
    value?: any;
    /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
    variant?: string;
  }[];
  /** Boolean toggle or multi-variant A/B test */
  type?: "boolean" | "variant";
  variants?: {
    /** Variant identifier, e.g., 'control', 'variant-a' */
    key: string;
    /** Percentage weight for assignment (0-100, all must sum to 100) */
    weight: number;
  }[];
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminFeatureFlagsByIdArgs = {
  id: string;
  body: {
    /** Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added. */
    archived?: boolean;
    /** Explanation of what this flag controls */
    description?: string;
    /** Global kill switch — if false, flag is off for everyone */
    enabled?: boolean;
    /** Unique identifier for the flag, e.g., 'new-checkout-flow' */
    key?: string;
    /** Human-readable display name */
    name?: string;
    /** For boolean flags with no matching rules: percentage of users who get true */
    rolloutPercentage?: number;
    rules?: {
      /** Whether the flag/variant is turned on when this rule matches. For boolean flags this is the override value; for variant flags it gates whether the forced variant applies. */
      enabled?: boolean;
      /** User field to match against (use with operator + value). Supports dot notation, e.g., 'email', 'admin', 'address.zip'. Use field/operator/value together, OR segment alone. */
      field?: string;
      /** Comparison operator for field-based rules (use with field + value). Use field/operator/value together, OR segment alone. */
      operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
      /** Name of a registered segment function, e.g., 'pro-users'. Use segment alone, OR field/operator/value together. */
      segment?: string;
      /** Value to compare against (use with field + operator). String, number, boolean, or array for in/nin. Use field/operator/value together, OR segment alone. */
      value?: any;
      /** For variant flags only: forced variant key when this rule matches. Use field/operator/value together, OR segment alone. */
      variant?: string;
    }[];
    /** Boolean toggle or multi-variant A/B test */
    type?: "boolean" | "variant";
    variants?: {
      /** Variant identifier, e.g., 'control', 'variant-a' */
      key: string;
      /** Percentage weight for assignment (0-100, all must sum to 100) */
      weight: number;
    }[];
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminFeatureFlagsByIdRes = unknown;
export type DeleteAdminFeatureFlagsByIdArgs = string;
export type PostAdminTodosRes = /** status 201 Successful create */ {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminTodosArgs = {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId?: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title?: string;
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminTodosRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId: any;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title: string;
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminTodosArgs = {
  _id?: {
    $in?: string[];
  };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminTodosByIdRes = /** status 200 Successful read */ {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminTodosByIdArgs = string;
export type PatchAdminTodosByIdRes = /** status 200 Successful update */ {
  /** Whether the todo item has been completed */
  completed?: boolean;
  /** The user who owns this todo */
  ownerId: any;
  /** Priority level of the todo */
  priority?: "low" | "medium" | "high";
  /** Free-form tags for categorization */
  tags?: string[];
  /** The title of the todo item */
  title: string;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminTodosByIdArgs = {
  id: string;
  body: {
    /** Whether the todo item has been completed */
    completed?: boolean;
    /** The user who owns this todo */
    ownerId?: any;
    /** Priority level of the todo */
    priority?: "low" | "medium" | "high";
    /** Free-form tags for categorization */
    tags?: string[];
    /** The title of the todo item */
    title?: string;
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminTodosByIdRes = unknown;
export type DeleteAdminTodosByIdArgs = string;
export type PostAdminUsersRes = /** status 201 Successful create */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminUsersArgs = {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email?: string;
  /** The user's display name */
  name?: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id?: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminUsersRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email: string;
    /** The user's display name */
    name: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    _id: string;
    hash?: string;
    salt?: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminUsersArgs = {
  _id?: {
    $in?: string[];
  };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminUsersByIdRes = /** status 200 Successful read */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminUsersByIdArgs = string;
export type PatchAdminUsersByIdRes = /** status 200 Successful update */ {
  /** Whether the user has admin privileges */
  admin?: boolean;
  /** Identifier linking to the Better Auth session provider */
  betterAuthId?: string;
  /** The user's email address, used for authentication */
  email: string;
  /** The user's display name */
  name: string;
  /** OAuth provider used for authentication */
  oauthProvider?: "google" | "github" | "apple" | null;
  _id: string;
  hash?: string;
  salt?: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminUsersByIdArgs = {
  id: string;
  body: {
    /** Whether the user has admin privileges */
    admin?: boolean;
    /** Identifier linking to the Better Auth session provider */
    betterAuthId?: string;
    /** The user's email address, used for authentication */
    email?: string;
    /** The user's display name */
    name?: string;
    /** OAuth provider used for authentication */
    oauthProvider?: "google" | "github" | "apple" | null;
    _id?: string;
    hash?: string;
    salt?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminUsersByIdRes = unknown;
export type DeleteAdminUsersByIdArgs = string;
export type PostAdminConsentFormsRes = /** status 201 Successful create */ {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug: string;
  /** Human-readable title of the consent form */
  title: string;
  /** Category of consent form */
  type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version: number;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminConsentFormsArgs = {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content?: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order?: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug?: string;
  /** Human-readable title of the consent form */
  title?: string;
  /** Category of consent form */
  type?: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version?: number;
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminConsentFormsRes = /** status 200 Successful list */ {
  data?: {
    /** Whether this consent form is currently active and available to users */
    active?: boolean;
    /** Label text for the agreement button */
    agreeButtonText?: string;
    /** Whether users are allowed to decline the consent form */
    allowDecline?: boolean;
    /** Whether to require a drawn or typed signature when the user agrees */
    captureSignature?: boolean;
    /** List of checkboxes the user must interact with before agreeing */
    checkboxes?: {
      /** Optional prompt shown when the user checks this checkbox */
      confirmationPrompt?: string;
      /** Display label for the checkbox */
      label: string;
      /** Whether this checkbox must be checked before the user can agree */
      required?: boolean;
    }[];
    /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
    content: {
      [key: string]: string;
    };
    /** Label text for the decline button (only shown when allowDecline is true) */
    declineButtonText?: string;
    /** Default locale to use when the requested locale is not available */
    defaultLocale?: string;
    /** Display order relative to other consent forms (lower numbers appear first) */
    order: number;
    /** Whether users must complete this form before accessing the application */
    required?: boolean;
    /** Whether users must scroll to the bottom of the form content before agreeing */
    requireScrollToBottom?: boolean;
    /** URL-safe identifier for this form, combined with version to uniquely identify a form */
    slug: string;
    /** Human-readable title of the consent form */
    title: string;
    /** Category of consent form */
    type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
    /** Version number of this form. Incrementing the version requires users to re-consent */
    version: number;
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminConsentFormsArgs = {
  _id?: {
    $in?: string[];
  };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminConsentFormsByIdRes = /** status 200 Successful read */ {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug: string;
  /** Human-readable title of the consent form */
  title: string;
  /** Category of consent form */
  type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version: number;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminConsentFormsByIdArgs = string;
export type PatchAdminConsentFormsByIdRes = /** status 200 Successful update */ {
  /** Whether this consent form is currently active and available to users */
  active?: boolean;
  /** Label text for the agreement button */
  agreeButtonText?: string;
  /** Whether users are allowed to decline the consent form */
  allowDecline?: boolean;
  /** Whether to require a drawn or typed signature when the user agrees */
  captureSignature?: boolean;
  /** List of checkboxes the user must interact with before agreeing */
  checkboxes?: {
    /** Optional prompt shown when the user checks this checkbox */
    confirmationPrompt?: string;
    /** Display label for the checkbox */
    label: string;
    /** Whether this checkbox must be checked before the user can agree */
    required?: boolean;
  }[];
  /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
  content: {
    [key: string]: string;
  };
  /** Label text for the decline button (only shown when allowDecline is true) */
  declineButtonText?: string;
  /** Default locale to use when the requested locale is not available */
  defaultLocale?: string;
  /** Display order relative to other consent forms (lower numbers appear first) */
  order: number;
  /** Whether users must complete this form before accessing the application */
  required?: boolean;
  /** Whether users must scroll to the bottom of the form content before agreeing */
  requireScrollToBottom?: boolean;
  /** URL-safe identifier for this form, combined with version to uniquely identify a form */
  slug: string;
  /** Human-readable title of the consent form */
  title: string;
  /** Category of consent form */
  type: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
  /** Version number of this form. Incrementing the version requires users to re-consent */
  version: number;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminConsentFormsByIdArgs = {
  id: string;
  body: {
    /** Whether this consent form is currently active and available to users */
    active?: boolean;
    /** Label text for the agreement button */
    agreeButtonText?: string;
    /** Whether users are allowed to decline the consent form */
    allowDecline?: boolean;
    /** Whether to require a drawn or typed signature when the user agrees */
    captureSignature?: boolean;
    /** List of checkboxes the user must interact with before agreeing */
    checkboxes?: {
      /** Optional prompt shown when the user checks this checkbox */
      confirmationPrompt?: string;
      /** Display label for the checkbox */
      label: string;
      /** Whether this checkbox must be checked before the user can agree */
      required?: boolean;
    }[];
    /** Locale-keyed map of Markdown content for this form (e.g. {"en": "# Terms\n..."}) */
    content?: {
      [key: string]: string;
    };
    /** Label text for the decline button (only shown when allowDecline is true) */
    declineButtonText?: string;
    /** Default locale to use when the requested locale is not available */
    defaultLocale?: string;
    /** Display order relative to other consent forms (lower numbers appear first) */
    order?: number;
    /** Whether users must complete this form before accessing the application */
    required?: boolean;
    /** Whether users must scroll to the bottom of the form content before agreeing */
    requireScrollToBottom?: boolean;
    /** URL-safe identifier for this form, combined with version to uniquely identify a form */
    slug?: string;
    /** Human-readable title of the consent form */
    title?: string;
    /** Category of consent form */
    type?: "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";
    /** Version number of this form. Incrementing the version requires users to re-consent */
    version?: number;
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminConsentFormsByIdRes = unknown;
export type DeleteAdminConsentFormsByIdArgs = string;
export type PostAdminConsentResponsesRes = /** status 201 Successful create */ {
  /** Whether the user agreed (true) or declined (false) the consent form */
  agreed: boolean;
  /** Timestamp when the user submitted their agreement or declination */
  agreedAt: string;
  /** Map of checkbox index to boolean indicating whether each checkbox was checked */
  checkboxValues?: {
    [key: string]: boolean;
  };
  /** Reference to the ConsentForm that was responded to */
  consentFormId: any;
  /** Snapshot of the form content in the user's locale at the time of response */
  contentSnapshot?: string;
  /** Version number of the form at the time the user responded */
  formVersionSnapshot?: number;
  /** IP address of the user at the time of response, captured for audit purposes */
  ipAddress?: string;
  /** Locale code of the content version the user viewed when responding */
  locale: string;
  /** Base64-encoded signature image or typed signature text, if captured */
  signature?: string;
  /** Timestamp when the user provided their signature */
  signedAt?: string;
  /** User-agent string of the browser or app used to submit the response */
  userAgent?: string;
  /** Reference to the User who submitted this response */
  userId: any;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PostAdminConsentResponsesArgs = {
  /** Whether the user agreed (true) or declined (false) the consent form */
  agreed?: boolean;
  /** Timestamp when the user submitted their agreement or declination */
  agreedAt?: string;
  /** Map of checkbox index to boolean indicating whether each checkbox was checked */
  checkboxValues?: {
    [key: string]: boolean;
  };
  /** Reference to the ConsentForm that was responded to */
  consentFormId?: any;
  /** Snapshot of the form content in the user's locale at the time of response */
  contentSnapshot?: string;
  /** Version number of the form at the time the user responded */
  formVersionSnapshot?: number;
  /** IP address of the user at the time of response, captured for audit purposes */
  ipAddress?: string;
  /** Locale code of the content version the user viewed when responding */
  locale?: string;
  /** Base64-encoded signature image or typed signature text, if captured */
  signature?: string;
  /** Timestamp when the user provided their signature */
  signedAt?: string;
  /** User-agent string of the browser or app used to submit the response */
  userAgent?: string;
  /** Reference to the User who submitted this response */
  userId?: any;
  _id?: string;
  /** When this document was last updated */
  updated?: string;
  /** When this document was created */
  created?: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminConsentResponsesRes = /** status 200 Successful list */ {
  data?: {
    /** Whether the user agreed (true) or declined (false) the consent form */
    agreed: boolean;
    /** Timestamp when the user submitted their agreement or declination */
    agreedAt: string;
    /** Map of checkbox index to boolean indicating whether each checkbox was checked */
    checkboxValues?: {
      [key: string]: boolean;
    };
    /** Reference to the ConsentForm that was responded to */
    consentFormId: any;
    /** Snapshot of the form content in the user's locale at the time of response */
    contentSnapshot?: string;
    /** Version number of the form at the time the user responded */
    formVersionSnapshot?: number;
    /** IP address of the user at the time of response, captured for audit purposes */
    ipAddress?: string;
    /** Locale code of the content version the user viewed when responding */
    locale: string;
    /** Base64-encoded signature image or typed signature text, if captured */
    signature?: string;
    /** Timestamp when the user provided their signature */
    signedAt?: string;
    /** User-agent string of the browser or app used to submit the response */
    userAgent?: string;
    /** Reference to the User who submitted this response */
    userId: any;
    _id: string;
    /** When this document was last updated */
    updated: string;
    /** When this document was created */
    created: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  }[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
};
export type GetAdminConsentResponsesArgs = {
  _id?: {
    $in?: string[];
  };
  page?: number;
  sort?: string;
  limit?: number;
};
export type GetAdminConsentResponsesByIdRes = /** status 200 Successful read */ {
  /** Whether the user agreed (true) or declined (false) the consent form */
  agreed: boolean;
  /** Timestamp when the user submitted their agreement or declination */
  agreedAt: string;
  /** Map of checkbox index to boolean indicating whether each checkbox was checked */
  checkboxValues?: {
    [key: string]: boolean;
  };
  /** Reference to the ConsentForm that was responded to */
  consentFormId: any;
  /** Snapshot of the form content in the user's locale at the time of response */
  contentSnapshot?: string;
  /** Version number of the form at the time the user responded */
  formVersionSnapshot?: number;
  /** IP address of the user at the time of response, captured for audit purposes */
  ipAddress?: string;
  /** Locale code of the content version the user viewed when responding */
  locale: string;
  /** Base64-encoded signature image or typed signature text, if captured */
  signature?: string;
  /** Timestamp when the user provided their signature */
  signedAt?: string;
  /** User-agent string of the browser or app used to submit the response */
  userAgent?: string;
  /** Reference to the User who submitted this response */
  userId: any;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type GetAdminConsentResponsesByIdArgs = string;
export type PatchAdminConsentResponsesByIdRes = /** status 200 Successful update */ {
  /** Whether the user agreed (true) or declined (false) the consent form */
  agreed: boolean;
  /** Timestamp when the user submitted their agreement or declination */
  agreedAt: string;
  /** Map of checkbox index to boolean indicating whether each checkbox was checked */
  checkboxValues?: {
    [key: string]: boolean;
  };
  /** Reference to the ConsentForm that was responded to */
  consentFormId: any;
  /** Snapshot of the form content in the user's locale at the time of response */
  contentSnapshot?: string;
  /** Version number of the form at the time the user responded */
  formVersionSnapshot?: number;
  /** IP address of the user at the time of response, captured for audit purposes */
  ipAddress?: string;
  /** Locale code of the content version the user viewed when responding */
  locale: string;
  /** Base64-encoded signature image or typed signature text, if captured */
  signature?: string;
  /** Timestamp when the user provided their signature */
  signedAt?: string;
  /** User-agent string of the browser or app used to submit the response */
  userAgent?: string;
  /** Reference to the User who submitted this response */
  userId: any;
  _id: string;
  /** When this document was last updated */
  updated: string;
  /** When this document was created */
  created: string;
  /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
  deleted?: boolean;
};
export type PatchAdminConsentResponsesByIdArgs = {
  id: string;
  body: {
    /** Whether the user agreed (true) or declined (false) the consent form */
    agreed?: boolean;
    /** Timestamp when the user submitted their agreement or declination */
    agreedAt?: string;
    /** Map of checkbox index to boolean indicating whether each checkbox was checked */
    checkboxValues?: {
      [key: string]: boolean;
    };
    /** Reference to the ConsentForm that was responded to */
    consentFormId?: any;
    /** Snapshot of the form content in the user's locale at the time of response */
    contentSnapshot?: string;
    /** Version number of the form at the time the user responded */
    formVersionSnapshot?: number;
    /** IP address of the user at the time of response, captured for audit purposes */
    ipAddress?: string;
    /** Locale code of the content version the user viewed when responding */
    locale?: string;
    /** Base64-encoded signature image or typed signature text, if captured */
    signature?: string;
    /** Timestamp when the user provided their signature */
    signedAt?: string;
    /** User-agent string of the browser or app used to submit the response */
    userAgent?: string;
    /** Reference to the User who submitted this response */
    userId?: any;
    _id?: string;
    /** When this document was last updated */
    updated?: string;
    /** When this document was created */
    created?: string;
    /** Deleted objects are not returned in any find() or findOne() by default. Add {deleted: true} to find them. */
    deleted?: boolean;
  };
};
export type DeleteAdminConsentResponsesByIdRes = unknown;
export type DeleteAdminConsentResponsesByIdArgs = string;
export type ApiError = {
  /** An application-specific error code, expressed as a string value. */
  code?: string;
  /** A human-readable explanation specific to this occurrence of the problem. Like title, this field’s value can be localized. */
  detail?: string;
  /** A unique identifier for this particular occurrence of the problem. */
  id?: string;
  links?: {
    /** A link that leads to further details about this particular occurrence of the problem. When derefenced, this URI SHOULD return a human-readable description of the error. */
    about?: string;
    /** A link that identifies the type of error that this particular error is an instance of. This URI SHOULD be dereferencable to a human-readable explanation of the general error. */
    type?: string;
  };
  /** A meta object containing non-standard meta-information about the error. */
  meta?: object;
  source?: {
    /** A string indicating the name of a single request header which caused the error. */
    header?: string;
    /** A string indicating which URI query parameter caused the error. */
    parameter?: string;
    /** A JSON Pointer [RFC6901] to the associated entity in the request document [e.g. "/data" for a primary data object, or "/data/attributes/title" for a specific attribute]. */
    pointer?: string;
  };
  /** The HTTP status code applicable to this problem, expressed as a string value. */
  status?: number;
  /** The error message */
  title?: string;
};
export const {
  usePostMutation,
  use$getQuery,
  useGetByIdQuery,
  usePatchByIdMutation,
  useDeleteByIdMutation,
  usePostGptPromptMutation,
  usePatchGptHistoriesByIdRatingMutation,
  usePostGptRemixMutation,
  useGetGptToolsQuery,
  useGetAiRequestsExplorerQuery,
  usePostAdminUsersByIdPasswordMutation,
  useGetSettingsGcsQuery,
  usePostSettingsGcsMutation,
  useDeleteSettingsGcsMutation,
  useTodosMarkCompleteMutation,
  useTodosBulkCompleteMutation,
  usePostTodosMutation,
  useGetTodosQuery,
  useGetTodosByIdQuery,
  usePatchTodosByIdMutation,
  useDeleteTodosByIdMutation,
  usePostFeatureFlagsFlagsMutation,
  useGetFeatureFlagsFlagsQuery,
  useGetFeatureFlagsFlagsByIdQuery,
  usePatchFeatureFlagsFlagsByIdMutation,
  useDeleteFeatureFlagsFlagsByIdMutation,
  usePostAdminFeatureFlagsMutation,
  useGetAdminFeatureFlagsQuery,
  useGetAdminFeatureFlagsByIdQuery,
  usePatchAdminFeatureFlagsByIdMutation,
  useDeleteAdminFeatureFlagsByIdMutation,
  usePostAdminTodosMutation,
  useGetAdminTodosQuery,
  useGetAdminTodosByIdQuery,
  usePatchAdminTodosByIdMutation,
  useDeleteAdminTodosByIdMutation,
  usePostAdminUsersMutation,
  useGetAdminUsersQuery,
  useGetAdminUsersByIdQuery,
  usePatchAdminUsersByIdMutation,
  useDeleteAdminUsersByIdMutation,
  usePostAdminConsentFormsMutation,
  useGetAdminConsentFormsQuery,
  useGetAdminConsentFormsByIdQuery,
  usePatchAdminConsentFormsByIdMutation,
  useDeleteAdminConsentFormsByIdMutation,
  usePostAdminConsentResponsesMutation,
  useGetAdminConsentResponsesQuery,
  useGetAdminConsentResponsesByIdQuery,
  usePatchAdminConsentResponsesByIdMutation,
  useDeleteAdminConsentResponsesByIdMutation,
} = injectedRtkApi;
