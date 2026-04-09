import type {Page} from "@playwright/test";

const API_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const mockGptStream = async (
  page: Page,
  responseText: string,
  options?: {historyId?: string; title?: string}
): Promise<void> => {
  const historyId = options?.historyId ?? `mock-history-${Date.now()}`;
  const title = options?.title ?? "Mock Chat";

  await page.route(`${API_URL}/gpt/prompt`, (route) => {
    const chunks: string[] = [];

    // Split response into word-level chunks for realistic streaming
    const words = responseText.split(" ");
    for (const word of words) {
      chunks.push(`data: ${JSON.stringify({text: `${word} `})}\n\n`);
    }

    // Send the done event
    chunks.push(`data: ${JSON.stringify({done: true, historyId, title})}\n\n`);

    const body = chunks.join("");

    route.fulfill({
      body,
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      },
      status: 200,
    });
  });
};

export const unmockGptStream = async (page: Page): Promise<void> => {
  await page.unroute(`${API_URL}/gpt/prompt`);
};
