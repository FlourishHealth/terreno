import {chromium} from "playwright";

const BASE_URL = process.env.DEMO_URL ?? "http://localhost:8085";
const ROUTES = (process.env.DEMO_ROUTES ?? "/demo,/demo/Toast,/demo/DateTimeField").split(",");

const run = async () => {
  const browser = await chromium.launch();
  const offenders = [];
  const shadowRoutes = [];

  for (const route of ROUTES) {
    // A fresh context per route resets react-native-web's warn-once cache.
    const context = await browser.newContext();
    const page = await context.newPage();
    let sawPointerEvents = false;
    let sawShadow = false;
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("props.pointerEvents is deprecated")) {
        sawPointerEvents = true;
      }
      if (text.includes('"shadow*" style props are deprecated')) {
        sawShadow = true;
      }
    });
    await page.goto(`${BASE_URL}${route}`, {waitUntil: "networkidle", timeout: 180000});
    await page.waitForTimeout(4000);
    if (sawPointerEvents) {
      offenders.push(route);
    }
    if (sawShadow) {
      shadowRoutes.push(route);
    }
    await context.close();
  }

  await browser.close();

  console.log(`routes visited: ${ROUTES.length}`);
  console.log(`routes warning "props.pointerEvents is deprecated": ${offenders.length}`);
  for (const route of offenders) {
    console.log(`  - ${route}`);
  }
  console.log(`routes warning "shadow*" (untouched baseline): ${shadowRoutes.length}`);
  process.exit(offenders.length === 0 ? 0 : 1);
};

run();
