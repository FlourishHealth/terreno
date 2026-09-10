import {chromium} from "@playwright/test";
import {MongoClient} from "mongodb";

const FRONTEND = process.env.FRONTEND_URL ?? "http://localhost:8082";
const API = process.env.BACKEND_URL ?? "http://localhost:4000";
const MONGO_URI =
  process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/terreno-example?directConnection=true";

const ADMIN = {
  email: "admin@example.com",
  password: "testpassword123",
};

const signIn = async (request) => {
  const response = await request.post(`${API}/api/auth/sign-in/email`, {
    data: {email: ADMIN.email, password: ADMIN.password},
  });
  if (!response.ok()) {
    throw new Error(`sign-in failed: ${response.status()} ${await response.text()}`);
  }
  const cookies = await response.headersArray();
  const setCookie = cookies.filter((header) => header.name.toLowerCase() === "set-cookie");
  return setCookie.map((header) => header.value).join("; ");
};

const main = async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  await client
    .db()
    .collection("users")
    .updateOne({email: ADMIN.email}, {$addToSet: {roles: "superadmin"}, $set: {admin: true}});

  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  const depthErrors = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("Maximum update depth exceeded")) {
      depthErrors.push(text);
      console.error("DEPTH_ERROR:", text);
    }
  });

  await page.goto(`${FRONTEND}/login`);
  await page.getByTestId("login-screen").waitFor({state: "visible", timeout: 60_000});
  await page.getByTestId("login-screen-email-input").fill(ADMIN.email);
  await page.getByTestId("login-screen-password-input").fill(ADMIN.password);
  await page.getByTestId("login-screen-submit-button").click();
  await page
    .locator('[data-testid="todos-screen"], [data-testid="consent-form-footer"]')
    .first()
    .waitFor({state: "visible", timeout: 60_000});

  const apiContext = await browser.newContext();
  const request = apiContext.request;
  const cookieHeader = await signIn(request);

  const createResponse = await request.post(`${API}/todos`, {
    data: {title: "Loop repro seed"},
    headers: {cookie: cookieHeader},
  });
  const created = await createResponse.json();
  const todoId = created.data?._id;
  console.info("created todo", todoId);

  await page.goto(`${FRONTEND}/admin/Todo`);
  await page.getByTestId("admin-create-button").waitFor({state: "visible", timeout: 60_000});

  await page.getByText("Loop repro seed").locator("visible=true").first().click();
  await page.getByTestId("admin-save-button").waitFor({state: "visible", timeout: 15_000});

  await request.patch(`${API}/todos/${todoId}`, {
    data: {title: "Server title diverged while editing"},
    headers: {cookie: cookieHeader},
  });

  await page.getByTestId("admin-field-title").fill("Local conflicting title");

  const patchPromise = request.patch(`${API}/todos/${todoId}`, {
    data: {title: "Server race during save"},
    headers: {cookie: cookieHeader},
  });
  await page.getByTestId("admin-save-button").click();
  await patchPromise;

  const conflictVisible = await page
    .getByTestId(`conflict-item-${todoId}`)
    .waitFor({state: "visible", timeout: 20_000})
    .then(() => true)
    .catch(() => false);

  if (!conflictVisible) {
    const bodyText = await page.locator("body").innerText();
    console.warn("No conflict sheet; page excerpt:", bodyText.slice(0, 500));
    await page.screenshot({path: "/opt/cursor/artifacts/admin-save-no-conflict.png", fullPage: true});
    throw new Error("Could not surface admin conflict sheet — adjust repro preconditions");
  }
  console.info("conflict sheet visible");

  await page.getByTestId("conflict-use-mine-all-button").click();
  await page.getByRole("button", {exact: true, name: "Confirm"}).click();

  await page.waitForTimeout(5000);

  console.info("depth error count", depthErrors.length);
  if (depthErrors.length > 0) {
    process.exitCode = 1;
  }

  await browser.close();
  await client.close();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
