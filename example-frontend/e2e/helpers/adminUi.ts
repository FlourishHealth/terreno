import type {Page} from "@playwright/test";

/** AdminHome grid and legacy model cards use @terreno/ui Box `onClick`, which exposes `${testID}-clickable`. */
export const adminModelEntry = (page: Page, modelName: string) =>
  page
    .getByTestId(`admin-home-models-grid-${modelName}-clickable`)
    .or(page.getByTestId(`admin-model-card-${modelName}-clickable`))
    .or(page.getByTestId(`admin-home-models-grid-${modelName}`))
    .or(page.getByTestId(`admin-model-card-${modelName}`));

/** Wait until the admin shell has mounted after login/navigation. */
export const waitForAdminHome = async (page: Page): Promise<void> => {
  await adminModelEntry(page, "Todo").first().waitFor({state: "visible", timeout: 15_000});
};

/** Wait until a model changelist is interactive. */
export const waitForAdminTable = async (page: Page): Promise<void> => {
  await page.getByTestId("admin-create-button").waitFor({state: "visible", timeout: 15_000});
};
