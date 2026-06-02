import {emptySplitApi as api} from "@terreno/rtk";

export const addTagTypes = ["todos", "users", "profile", "gptHistories"] as const;

// Todo types
export interface Todo {
  _id: string;
  id: string;
  title: string;
  completed: boolean;
  ownerId: string;
  created: string;
  updated: string;
}

export interface TodosListResponse {
  data: Todo[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
}

export interface TodoResponse {
  data: Todo;
}

export interface CreateTodoBody {
  title: string;
  completed?: boolean;
}

export interface UpdateTodoBody {
  title?: string;
  completed?: boolean;
}

export interface TodosBulkCompleteBody {
  ids: string[];
}

export interface TodosBulkCompleteResponse {
  data: {
    matched: number;
    modified: number;
  };
}

// GptHistory types
export interface GptHistoryPrompt {
  text: string;
  type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
  model?: string;
  content?: Array<{
    type: string;
    text?: string;
    url?: string;
    mimeType?: string;
    filename?: string;
  }>;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface GptHistory {
  _id: string;
  id: string;
  created: string;
  updated: string;
  prompts: GptHistoryPrompt[];
  rating?: number;
}

export interface GptHistoriesListResponse {
  data: GptHistory[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
}

export interface GptHistoryResponse {
  data: GptHistory;
}

export interface CreateGptHistoryBody {
  prompts: GptHistoryPrompt[];
  rating?: number;
}

export interface UpdateGptHistoryBody {
  prompts?: GptHistoryPrompt[];
  rating?: number;
}

const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      deleteGptHistoriesById: build.mutation<void, {id: string}>({
        invalidatesTags: (_result, _error, {id}) => [
          {id, type: "gptHistories" as const},
          {id: "LIST", type: "gptHistories" as const},
        ],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/gpt/histories/${queryArg.id}`,
        }),
      }),
      deleteTodosById: build.mutation<void, {id: string}>({
        invalidatesTags: (_result, _error, {id}) => [
          {id, type: "todos" as const},
          {id: "LIST", type: "todos" as const},
        ],
        query: (queryArg) => ({
          method: "DELETE",
          url: `/todos/${queryArg.id}`,
        }),
      }),
      getGptHistories: build.query<
        GptHistoriesListResponse,
        {limit?: number; page?: number; sort?: string}
      >({
        providesTags: (result) =>
          result?.data
            ? [
                ...result.data.map(({id}) => ({id, type: "gptHistories" as const})),
                {id: "LIST", type: "gptHistories" as const},
              ]
            : [{id: "LIST", type: "gptHistories" as const}],
        query: (queryArg) => ({
          params: {
            limit: queryArg.limit,
            page: queryArg.page,
            sort: queryArg.sort,
          },
          url: "/gpt/histories",
        }),
      }),
      getGptHistoriesById: build.query<GptHistoryResponse, {id: string}>({
        providesTags: (_result, _error, {id}) => [{id, type: "gptHistories" as const}],
        query: (queryArg) => ({url: `/gpt/histories/${queryArg.id}`}),
      }),
      // Todos endpoints
      getTodos: build.query<TodosListResponse, {completed?: boolean; ownerId?: string}>({
        providesTags: (result) =>
          result?.data
            ? [
                ...result.data.map(({id}) => ({id, type: "todos" as const})),
                {id: "LIST", type: "todos" as const},
              ]
            : [{id: "LIST", type: "todos" as const}],
        query: (queryArg) => ({
          params: {
            completed: queryArg.completed,
            ownerId: queryArg.ownerId,
          },
          url: "/todos",
        }),
      }),
      getTodosById: build.query<TodoResponse, {id: string}>({
        providesTags: (_result, _error, {id}) => [{id, type: "todos" as const}],
        query: (queryArg) => ({url: `/todos/${queryArg.id}`}),
      }),
      getUsers: build.query<
        {data: Array<{_id: string; id: string; email: string; name: string}>},
        {limit?: number; page?: number}
      >({
        providesTags: (result) =>
          result?.data
            ? [
                ...result.data.map(({id}) => ({id, type: "users" as const})),
                {id: "LIST", type: "users" as const},
              ]
            : [{id: "LIST", type: "users" as const}],
        query: (queryArg) => ({
          params: {
            limit: queryArg.limit,
            page: queryArg.page,
          },
          url: "/users",
        }),
      }),
      getUsersById: build.query<
        {data: {_id: string; id: string; email: string; name: string}},
        {id: string}
      >({
        providesTags: (_result, _error, {id}) => [{id, type: "users" as const}],
        query: (queryArg) => ({url: `/users/${queryArg.id}`}),
      }),
      getVersionCheck: build.query<{data: {updateRequired: boolean}}, void>({
        query: () => ({url: "/versionCheck"}),
      }),
      patchGptHistoriesById: build.mutation<
        GptHistoryResponse,
        {id: string; body: UpdateGptHistoryBody}
      >({
        invalidatesTags: (_result, _error, {id}) => [
          {id, type: "gptHistories" as const},
          {id: "LIST", type: "gptHistories" as const},
        ],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/gpt/histories/${queryArg.id}`,
        }),
      }),
      patchTodosById: build.mutation<TodoResponse, {id: string; body: UpdateTodoBody}>({
        invalidatesTags: (_result, _error, {id}) => [
          {id, type: "todos" as const},
          {id: "LIST", type: "todos" as const},
        ],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/todos/${queryArg.id}`,
        }),
      }),
      patchUsersById: build.mutation<
        {data: {_id: string; id: string; email: string; name: string}},
        {id: string; body: {name?: string; email?: string}}
      >({
        invalidatesTags: (_result, _error, {id}) => [
          {id, type: "users" as const},
          {id: "LIST", type: "users" as const},
        ],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "PATCH",
          url: `/users/${queryArg.id}`,
        }),
      }),
      postGptHistories: build.mutation<GptHistoryResponse, {body: CreateGptHistoryBody}>({
        invalidatesTags: [{id: "LIST", type: "gptHistories" as const}],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "POST",
          url: "/gpt/histories",
        }),
      }),
      postTodos: build.mutation<TodoResponse, {body: CreateTodoBody}>({
        invalidatesTags: [{id: "LIST", type: "todos" as const}],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "POST",
          url: "/todos",
        }),
      }),
      todosBulkComplete: build.mutation<TodosBulkCompleteResponse, TodosBulkCompleteBody>({
        invalidatesTags: [{id: "LIST", type: "todos" as const}],
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: "/todos/bulkComplete",
        }),
      }),
      todosMarkComplete: build.mutation<TodoResponse, string>({
        invalidatesTags: (_result, _error, id) => [
          {id, type: "todos" as const},
          {id: "LIST", type: "todos" as const},
        ],
        query: (queryArg) => ({
          method: "POST",
          url: `/todos/${queryArg}/markComplete`,
        }),
      }),
    }),
    overrideExisting: false,
  });

export {injectedRtkApi as openapi};

export const {
  useDeleteGptHistoriesByIdMutation,
  useGetGptHistoriesQuery,
  useGetGptHistoriesByIdQuery,
  useGetVersionCheckQuery,
  useLazyGetVersionCheckQuery,
  usePatchGptHistoriesByIdMutation,
  usePostGptHistoriesMutation,
  useGetTodosQuery,
  useGetTodosByIdQuery,
  usePostTodosMutation,
  usePatchTodosByIdMutation,
  useDeleteTodosByIdMutation,
  useTodosBulkCompleteMutation,
  useTodosMarkCompleteMutation,
  useGetUsersQuery,
  useGetUsersByIdQuery,
  usePatchUsersByIdMutation,
} = injectedRtkApi;
