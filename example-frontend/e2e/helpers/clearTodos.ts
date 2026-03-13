import {request} from "@playwright/test";
import {TEST_USER} from "../fixtures/testUsers";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const clearTodos = async (): Promise<void> => {
  const apiContext = await request.newContext({baseURL: API_URL});

  const loginRes = await apiContext.post("/auth/login", {
    data: {email: TEST_USER.email, password: TEST_USER.password},
  });
  const loginData = await loginRes.json();
  const token = loginData.token as string;

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
