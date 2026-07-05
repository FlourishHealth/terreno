import {type APIRequestContext, request} from "@playwright/test";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export interface TodoApiUser {
  email: string;
  password: string;
}

export interface TodoRecord {
  _id: string;
  id: string;
  title: string;
  completed: boolean;
  updated?: string;
}

/**
 * User-parameterized todos API helpers for the syncdb e2e suite. Unlike
 * clearTodos.ts these accept any test user, which the user-switch and
 * multi-session scenarios need.
 */
const withAuthedContext = async <T>(
  user: TodoApiUser,
  fn: (ctx: APIRequestContext, headers: {authorization: string}) => Promise<T>
): Promise<T> => {
  const apiContext = await request.newContext({baseURL: API_URL});
  try {
    const loginRes = await apiContext.post("/auth/login", {
      data: {email: user.email, password: user.password},
    });
    if (!loginRes.ok()) {
      throw new Error(`todosApi: login failed for ${user.email} with status ${loginRes.status()}`);
    }
    const loginData = (await loginRes.json()) as {data?: {token?: string}; token?: string};
    const token = loginData?.data?.token ?? loginData?.token ?? "";
    if (!token) {
      throw new Error(`todosApi: no token in login response for ${user.email}`);
    }
    return await fn(apiContext, {authorization: `Bearer ${token}`});
  } finally {
    await apiContext.dispose();
  }
};

export const createTodoAs = async (user: TodoApiUser, title: string): Promise<TodoRecord> => {
  return withAuthedContext(user, async (ctx, headers) => {
    const res = await ctx.post("/todos", {data: {title}, headers});
    if (!res.ok()) {
      throw new Error(`todosApi: create failed with status ${res.status()}`);
    }
    const json = (await res.json()) as {data: TodoRecord};
    return json.data;
  });
};

export const patchTodoAs = async (
  user: TodoApiUser,
  todoId: string,
  body: Record<string, unknown>
): Promise<TodoRecord> => {
  return withAuthedContext(user, async (ctx, headers) => {
    const res = await ctx.patch(`/todos/${todoId}`, {data: body, headers});
    if (!res.ok()) {
      throw new Error(`todosApi: patch failed with status ${res.status()}`);
    }
    const json = (await res.json()) as {data: TodoRecord};
    return json.data;
  });
};

export const listTodosAs = async (user: TodoApiUser): Promise<TodoRecord[]> => {
  return withAuthedContext(user, async (ctx, headers) => {
    const res = await ctx.get("/todos", {headers});
    if (!res.ok()) {
      throw new Error(`todosApi: list failed with status ${res.status()}`);
    }
    const json = (await res.json()) as {data?: TodoRecord[]};
    return json.data ?? [];
  });
};

export const clearTodosAs = async (user: TodoApiUser): Promise<void> => {
  await withAuthedContext(user, async (ctx, headers) => {
    const res = await ctx.get("/todos", {headers});
    const json = (await res.json()) as {data?: TodoRecord[]};
    const todos = json.data ?? [];
    await Promise.all(todos.map((todo) => ctx.delete(`/todos/${todo.id ?? todo._id}`, {headers})));
  });
};
