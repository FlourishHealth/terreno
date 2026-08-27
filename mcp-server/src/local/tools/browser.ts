import {mkdir} from "node:fs/promises";
import {dirname, isAbsolute, resolve} from "node:path";

import {resolveTerrenoProjectRoot} from "../projectRoot.js";

export type BrowserAction =
  | "back"
  | "click"
  | "close"
  | "evaluate"
  | "forward"
  | "open"
  | "press"
  | "reload"
  | "screenshot"
  | "scroll"
  | "snapshot"
  | "type";

export interface BrowserToolArgs {
  action: BrowserAction;
  code?: string;
  dataDir?: string;
  height?: number;
  key?: string;
  modifiers?: Bun.WebView.Modifier[];
  output?: string;
  quality?: number;
  selector?: string;
  text?: string;
  timeout?: number;
  url?: string;
  width?: number;
  x?: number;
  y?: number;
}

interface BrowserView {
  readonly title: string;
  readonly url: string;
  back: () => Promise<void>;
  click: (selector: string, options?: Bun.WebView.ClickSelectorOptions) => Promise<void>;
  close: () => void;
  evaluate: <T = unknown>(code: string) => Promise<T>;
  forward: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  press: (key: string, options?: Bun.WebView.PressOptions) => Promise<void>;
  reload: () => Promise<void>;
  screenshot: (options?: {
    encoding?: "blob";
    format?: "jpeg" | "png" | "webp";
    quality?: number;
  }) => Promise<Blob>;
  scroll: (x: number, y: number) => Promise<void>;
  scrollTo: (selector: string, options?: Bun.WebView.ScrollToOptions) => Promise<void>;
  type: (text: string) => Promise<void>;
}

interface BrowserViewOptions {
  backend: "chrome" | "webkit";
  dataStore: "ephemeral" | {directory: string};
  height: number;
  width: number;
}

type CreateBrowserView = (options: BrowserViewOptions) => BrowserView;

const PAGE_SNAPSHOT_EXPRESSION = `(() => {
  const isVisible = (element) => {
    const style = globalThis.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  };
  const elements = Array.from(document.querySelectorAll(
    "a,button,input,select,textarea,[role],[tabindex]"
  )).filter(isVisible).slice(0, 200).map((element) => ({
    ariaLabel: element.getAttribute("aria-label"),
    disabled: Boolean(element.disabled) || element.getAttribute("aria-disabled") === "true",
    name: element.getAttribute("name"),
    placeholder: element.getAttribute("placeholder"),
    role: element.getAttribute("role") || element.tagName.toLowerCase(),
    selector: element.id
      ? "#" + CSS.escape(element.id)
      : element.getAttribute("data-testid")
        ? '[data-testid="' + CSS.escape(element.getAttribute("data-testid")) + '"]'
        : null,
    text: (element.innerText || element.value || "").trim().slice(0, 300),
    type: element.getAttribute("type"),
  }));
  return {
    elements,
    text: (document.body?.innerText || "").trim().slice(0, 20000),
    title: document.title,
    url: location.href,
  };
})()`;

const DEFAULT_HEIGHT = 720;
const DEFAULT_WIDTH = 1280;

const defaultCreateBrowserView: CreateBrowserView = (options): BrowserView => {
  if (typeof Bun.WebView !== "function") {
    throw new Error("Bun.WebView requires Bun 1.4 or newer.");
  }
  return new Bun.WebView(options);
};

const parseImageFormat = (output: string): "jpeg" | "png" | "webp" => {
  const lowerOutput = output.toLowerCase();
  if (lowerOutput.endsWith(".jpg") || lowerOutput.endsWith(".jpeg")) {
    return "jpeg";
  }
  if (lowerOutput.endsWith(".webp")) {
    return "webp";
  }
  return "png";
};

const resolveOutputPath = (output: string): string => {
  if (isAbsolute(output)) {
    return output;
  }
  return resolve(resolveTerrenoProjectRoot(), output);
};

const requireValue = (value: string | undefined, name: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Browser action requires ${name}.`);
  }
  return trimmed;
};

export class BrowserSession {
  private readonly createView: CreateBrowserView;
  private view: BrowserView | undefined;

  constructor(createView: CreateBrowserView = defaultCreateBrowserView) {
    this.createView = createView;
  }

  private requireView(): BrowserView {
    if (!this.view) {
      throw new Error("No browser session. Run the open action first.");
    }
    return this.view;
  }

  private pageState(): {title: string; url: string} {
    const view = this.requireView();
    return {title: view.title, url: view.url};
  }

  async run(args: BrowserToolArgs): Promise<unknown> {
    switch (args.action) {
      case "open": {
        const url = requireValue(args.url, "url");
        this.close();
        const backend = process.platform === "darwin" ? "webkit" : "chrome";
        const dataStore = args.dataDir
          ? {directory: resolveOutputPath(args.dataDir)}
          : "ephemeral";
        this.view = this.createView({
          backend,
          dataStore,
          height: args.height ?? DEFAULT_HEIGHT,
          width: args.width ?? DEFAULT_WIDTH,
        });
        await this.view.navigate(url);
        return {action: args.action, ok: true, ...this.pageState()};
      }
      case "click": {
        const selector = requireValue(args.selector, "selector");
        await this.requireView().click(selector, {timeout: args.timeout});
        return {action: args.action, ok: true, selector, ...this.pageState()};
      }
      case "type": {
        const text = args.text ?? "";
        if (args.selector) {
          await this.requireView().click(args.selector, {timeout: args.timeout});
        }
        await this.requireView().type(text);
        return {action: args.action, ok: true, selector: args.selector, ...this.pageState()};
      }
      case "press": {
        const key = requireValue(args.key, "key");
        await this.requireView().press(key, {modifiers: args.modifiers});
        return {action: args.action, key, ok: true, ...this.pageState()};
      }
      case "scroll": {
        if (args.selector) {
          await this.requireView().scrollTo(args.selector, {timeout: args.timeout});
        } else {
          await this.requireView().scroll(args.x ?? 0, args.y ?? 0);
        }
        return {action: args.action, ok: true, selector: args.selector, ...this.pageState()};
      }
      case "evaluate": {
        const code = requireValue(args.code, "code");
        const result = await this.requireView().evaluate(code);
        return {action: args.action, ok: true, result, ...this.pageState()};
      }
      case "snapshot": {
        const snapshot = await this.requireView().evaluate(PAGE_SNAPSHOT_EXPRESSION);
        return {action: args.action, ok: true, snapshot};
      }
      case "screenshot": {
        const output = resolveOutputPath(requireValue(args.output, "output"));
        await mkdir(dirname(output), {recursive: true});
        const image = await this.requireView().screenshot({
          format: parseImageFormat(output),
          quality: args.quality,
        });
        await Bun.write(output, image);
        return {action: args.action, ok: true, output, ...this.pageState()};
      }
      case "back": {
        await this.requireView().back();
        return {action: args.action, ok: true, ...this.pageState()};
      }
      case "forward": {
        await this.requireView().forward();
        return {action: args.action, ok: true, ...this.pageState()};
      }
      case "reload": {
        await this.requireView().reload();
        return {action: args.action, ok: true, ...this.pageState()};
      }
      case "close": {
        this.close();
        return {action: args.action, ok: true};
      }
      default: {
        throw new Error(`Unknown browser action: ${String(args.action)}`);
      }
    }
  }

  close(): void {
    this.view?.close();
    this.view = undefined;
  }
}

const browserSession = new BrowserSession();

export const useBrowser = async (args: BrowserToolArgs): Promise<string> => {
  const result = await browserSession.run(args);
  return JSON.stringify(result, null, 2);
};
