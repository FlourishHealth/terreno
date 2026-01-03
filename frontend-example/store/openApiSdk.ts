import {emptySplitApi as api} from "@terreno/rtk";

export const addTagTypes = ["todos", "users", "profile"] as const;

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

// User types
export interface User {
  _id: string;
  id: string;
  email: string;
  name: string;
  created: string;
  updated: string;
}

export interface UsersListResponse {
  data: User[];
  limit?: number;
  more?: boolean;
  page?: number;
  total?: number;
}

export interface UserResponse {
  data: User;
}

const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
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
      // Users endpoints
      getUsers: build.query<UsersListResponse, {email?: string; name?: string}>({
        providesTags: (result) =>
          result?.data
            ? [
                ...result.data.map(({id}) => ({id, type: "users" as const})),
                {id: "LIST", type: "users" as const},
              ]
            : [{id: "LIST", type: "users" as const}],
        query: (queryArg) => ({
          params: {
            email: queryArg.email,
            name: queryArg.name,
          },
          url: "/users",
        }),
      }),
      getUsersById: build.query<UserResponse, {id: string}>({
        providesTags: (_result, _error, {id}) => [{id, type: "users" as const}],
        query: (queryArg) => ({url: `/users/${queryArg.id}`}),
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
      patchUsersById: build.mutation<UserResponse, {id: string; body: Partial<User>}>({
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
      postTodos: build.mutation<TodoResponse, {body: CreateTodoBody}>({
        invalidatesTags: [{id: "LIST", type: "todos" as const}],
        query: (queryArg) => ({
          body: queryArg.body,
          method: "POST",
          url: "/todos",
        }),
      }),
    }),
    overrideExisting: false,
  });

export {injectedRtkApi as openapi};

export const {
  useGetTodosQuery,
  useGetTodosByIdQuery,
  usePostTodosMutation,
  usePatchTodosByIdMutation,
  useDeleteTodosByIdMutation,
  useGetUsersQuery,
  useGetUsersByIdQuery,
  usePatchUsersByIdMutation,
} = injectedRtkApi;
