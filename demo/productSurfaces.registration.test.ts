import {describe, expect, it} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const DEMO_CONFIG_PATH = join(import.meta.dir, "demoConfig.tsx");

const registeredConfigurationExports = (source: string): string[] => {
  const matches = [...source.matchAll(/^import \{([^}]+)\} from "@story-config\//gm)];
  const names: string[] = [];
  for (const match of matches) {
    const inner = match[1] ?? "";
    for (const part of inner.split(",")) {
      const name = part.trim();
      if (name.endsWith("Configuration")) {
        names.push(name);
      }
    }
  }
  return names;
};

describe("Product surfaces stay out of the UI demo", () => {
  it("does not register announcement or notification stories", () => {
    const source = readFileSync(DEMO_CONFIG_PATH, "utf8");
    const registered = registeredConfigurationExports(source);
    expect(registered).not.toContain("AnnouncementBannerConfiguration");
    expect(registered).not.toContain("AnnouncementScreenConfiguration");
    expect(registered).not.toContain("NotificationCenterConfiguration");
    expect(source).not.toMatch(/AnnouncementBanner|AnnouncementScreen|NotificationCenter/);
  });
});
