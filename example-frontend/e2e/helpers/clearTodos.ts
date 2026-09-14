import {request} from "@playwright/test";
import {TEST_USER} from "../fixtures/testUsers";
import {signUpOrSignInBetterAuth} from "./betterAuthSession";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const clearTodos = async (): Promise<void> => {
  const apiContext = await request.newContext({baseURL: API_URL});

  const token = await signUpOrSignInBetterAuth(apiContext, {
    email: TEST_USER.email,
    name: TEST_USER.name,
    password: TEST_USER.password,
  });

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
