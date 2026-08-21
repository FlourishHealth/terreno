import {chromium} from "playwright";

const BASE_URL = process.env.DEMO_URL ?? "http://localhost:8085";
const ROUTE = process.env.DEMO_ROUTE ?? "/demo";

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.addInitScript(() => {
    const renderers = new Map();
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      checkDCE: () => {},
      emit: () => {},
      inject: (renderer) => {
        const id = renderers.size + 1;
        renderers.set(id, renderer);
        return id;
      },
      off: () => {},
      on: () => {},
      onCommitFiberRoot: () => {},
      onCommitFiberUnmount: () => {},
      onPostCommitFiberRoot: () => {},
      renderers,
      sub: () => () => {},
      supportsFiber: true,
    };

    const componentName = (fiber) => {
      const type = fiber.elementType ?? fiber.type;
      if (typeof type === "string") {
        return type;
      }
      return type?.displayName ?? type?.name ?? null;
    };

    const originalWarn = console.warn.bind(console);
    console.warn = (...args) => {
      const text = args.map((a) => String(a)).join(" ");
      if (!text.includes("props.pointerEvents is deprecated")) {
        originalWarn(...args);
        return;
      }
      const names = [];
      for (const renderer of renderers.values()) {
        let fiber = renderer.getCurrentFiber?.();
        let depth = 0;
        while (fiber && depth < 30) {
          const name = componentName(fiber);
          if (name) {
            names.push(name);
          }
          fiber = fiber.return;
          depth += 1;
        }
        if (names.length) {
          break;
        }
      }
      originalWarn(`POINTER_EVENTS_OWNERS: ${names.join(" < ")}`);
    };
  });

  const page = await context.newPage();
  const owners = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("POINTER_EVENTS_OWNERS")) {
      owners.push(text);
    }
  });

  await page.goto(`${BASE_URL}${ROUTE}`, {waitUntil: "networkidle", timeout: 180000});
  await page.waitForTimeout(4000);
  await browser.close();

  console.log(`route: ${ROUTE}`);
  for (const owner of owners) {
    console.log(owner);
  }
  if (!owners.length) {
    console.log("no pointerEvents warning");
  }
};

run();
