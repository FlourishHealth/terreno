import {request} from "@playwright/test";
import {TEST_USER} from "../fixtures/testUsers";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const clearTodos = async (): Promise<void> => {
  const apiContext = await request.newContext({baseURL: API_URL});

  const loginRes = await apiContext.post("/auth/login", {
    data: {email: TEST_USER.email, password: TEST_USER.password},
  });
  if (!loginRes.ok()) {
    await apiContext.dispose();
    throw new Error(`clearTodos: login failed with status ${loginRes.status()}`);
  }
  const loginData = await loginRes.json();
  const token = (loginData.data?.token ?? loginData.token) as string;
  if (!token) {
    await apiContext.dispose();
    throw new Error("clearTodos: no token in login response");
  }

  const todosRes = await apiContext.get("/todos", {
    headers: {authorization: `Bearer ${token}`},
  });
  const todosData = await todosRes.json();
  const todos = (todosData.data ?? []) as Array<{id: string}>;

  await Promise.all(
    todos.map((todo) =>
      apiContext.delete(`/todos/${todo.id}`, {
        headers: {authorization: `Bearer ${token}`},
      })
    )
  );

  await apiContext.dispose();
};
