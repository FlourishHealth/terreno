import {type APIRequestContext, request} from "@playwright/test";
import {signUpOrSignInBetterAuth} from "./betterAuthSession";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export interface TodoApiUser {
  email: string;
  name?: string;
  password: string;
}

export interface TodoRecord {
  _id: string;
  id: string;
  title: string;
  completed: boolean;
  updated?: string;
}

const withAuthedContext = async <T>(
  user: TodoApiUser,
  fn: (ctx: APIRequestContext, headers: {authorization: string}) => Promise<T>
): Promise<T> => {
  const apiContext = await request.newContext({baseURL: API_URL});
  try {
    const token = await signUpOrSignInBetterAuth(apiContext, {
      email: user.email,
      name: user.name ?? user.email,
      password: user.password,
    });
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
