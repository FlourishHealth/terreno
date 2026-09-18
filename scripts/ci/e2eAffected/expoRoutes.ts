/**
 * Minimal Expo Router URL resolver: maps a path a Playwright spec navigates to
 * (`page.goto("/admin/Todo")`) onto the screen file that renders it. Used by
 * `shards.test.ts` to prove each shard declares the routes its specs drive.
 */
import {existsSync, readdirSync, statSync} from "node:fs";
import {join} from "node:path";

const ROUTE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

const isGroup = (name: string): boolean => name.startsWith("(") && name.endsWith(")");

const isDynamic = (name: string): boolean => name.startsWith("[");

/** The directory plus every `(group)` directory reachable without a URL segment. */
const expandGroups = (dirs: string[]): string[] => {
  const expanded: string[] = [];
  const queue = [...dirs];
  while (queue.length > 0) {
    const dir = queue.pop();
    if (!dir || expanded.includes(dir) || !existsSync(dir)) {
      continue;
    }
    expanded.push(dir);
    for (const entry of readdirSync(dir)) {
      const child = join(dir, entry);
      if (isGroup(entry) && statSync(child).isDirectory()) {
        queue.push(child);
      }
    }
  }
  return expanded;
};

const findRouteFile = ({dirs, segment}: {dirs: string[]; segment: string}): string | undefined => {
  const exact: string[] = [];
  const dynamic: string[] = [];
  for (const dir of dirs) {
    for (const extension of ROUTE_EXTENSIONS) {
      const candidate = join(dir, `${segment}${extension}`);
      if (existsSync(candidate)) {
        exact.push(candidate);
      }
    }
    if (!existsSync(dir)) {
      continue;
    }
    for (const entry of readdirSync(dir)) {
      if (isDynamic(entry) && ROUTE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        dynamic.push(join(dir, entry));
      }
    }
  }
  return exact[0] ?? dynamic[0];
};

const findRouteDirs = ({dirs, segment}: {dirs: string[]; segment: string}): string[] => {
  const exact: string[] = [];
  const dynamic: string[] = [];
  for (const dir of dirs) {
    const candidate = join(dir, segment);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      exact.push(candidate);
    }
    if (!existsSync(dir)) {
      continue;
    }
    for (const entry of readdirSync(dir)) {
      const child = join(dir, entry);
      if (isDynamic(entry) && statSync(child).isDirectory()) {
        dynamic.push(child);
      }
    }
  }
  return exact.length > 0 ? exact : dynamic;
};

const findIndexFile = (dirs: string[]): string | undefined => {
  for (const dir of dirs) {
    for (const extension of ROUTE_EXTENSIONS) {
      const candidate = join(dir, `index${extension}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
};

/** Absolute path of the screen that renders `url`, or undefined when unknown. */
export const resolveExpoRoute = ({
  appDir,
  url,
}: {
  appDir: string;
  url: string;
}): string | undefined => {
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  const segments = path.split("/").filter((segment) => segment.length > 0);
  let dirs = expandGroups([appDir]);
  for (const [index, segment] of segments.entries()) {
    const isLast = index === segments.length - 1;
    if (isLast) {
      const file = findRouteFile({dirs, segment});
      if (file) {
        return file;
      }
      const nested = expandGroups(findRouteDirs({dirs, segment}));
      return nested.length > 0 ? findIndexFile(nested) : undefined;
    }
    const nextDirs = findRouteDirs({dirs, segment});
    if (nextDirs.length === 0) {
      return undefined;
    }
    dirs = expandGroups(nextDirs);
  }
  return findIndexFile(dirs);
};

const GOTO_LITERAL = /goto\(\s*[`"']([^`"']*)[`"']/g;

/** Every literal URL a spec navigates to with `page.goto(...)`. */
export const parseGotoUrls = (source: string): string[] => {
  const urls = new Set<string>();
  for (const match of source.matchAll(GOTO_LITERAL)) {
    const url = match[1];
    if (url?.startsWith("/")) {
      urls.add(url);
    }
  }
  return [...urls];
};
