import {describe, expect, test} from "bun:test";
import {resources} from "../resources.js";

describe("resources", () => {
  test("should have all required resources", () => {
    const resourceUris = resources.map((r) => r.uri);

    expect(resourceUris).toContain("terreno://docs/overview");
    expect(resourceUris).toContain("terreno://docs/api");
    expect(resourceUris).toContain("terreno://docs/ui");
    expect(resourceUris).toContain("terreno://docs/rtk");
    expect(resourceUris).toContain("terreno://docs/patterns");
  });

  test("should have valid resource structure", () => {
    for (const resource of resources) {
      expect(resource.uri).toBeDefined();
      expect(resource.name).toBeDefined();
      expect(resource.description).toBeDefined();
      expect(resource.mimeType).toBe("text/markdown");
      expect(resource.content).toBeDefined();
      expect(resource.content.length).toBeGreaterThan(100);
    }
  });

  describe("overview resource", () => {
    const overview = resources.find((r) => r.uri === "terreno://docs/overview");

    test("should contain monorepo overview", () => {
      expect(overview?.content).toContain("Terreno");
      expect(overview?.content).toContain("@terreno/api");
      expect(overview?.content).toContain("@terreno/ui");
      expect(overview?.content).toContain("@terreno/rtk");
    });

    test("should contain development commands", () => {
      expect(overview?.content).toContain("bun install");
      expect(overview?.content).toContain("bun run compile");
    });

    test("should contain code style guidelines", () => {
      expect(overview?.content).toContain("TypeScript");
      expect(overview?.content).toContain("Luxon");
    });
  });

  describe("api resource", () => {
    const api = resources.find((r) => r.uri === "terreno://docs/api");

    test("should contain modelRouter documentation", () => {
      expect(api?.content).toContain("modelRouter");
      expect(api?.content).toContain("CRUD");
    });

    test("should contain permissions documentation", () => {
      expect(api?.content).toContain("Permissions");
      expect(api?.content).toContain("IsAuthenticated");
      expect(api?.content).toContain("IsOwner");
      expect(api?.content).toContain("IsAdmin");
    });

    test("should contain APIError documentation", () => {
      expect(api?.content).toContain("APIError");
      expect(api?.content).toContain("status");
    });

    test("should contain lifecycle hooks", () => {
      expect(api?.content).toContain("preCreate");
      expect(api?.content).toContain("postCreate");
    });

    test("should contain transformer documentation", () => {
      expect(api?.content).toContain("Transformer");
      expect(api?.content).toContain("AdminOwnerTransformer");
    });
  });

  describe("ui resource", () => {
    const ui = resources.find((r) => r.uri === "terreno://docs/ui");

    test("should contain component documentation", () => {
      expect(ui?.content).toContain("Box");
      expect(ui?.content).toContain("Button");
      expect(ui?.content).toContain("Text");
    });

    test("should contain form field documentation", () => {
      expect(ui?.content).toContain("TextField");
      expect(ui?.content).toContain("EmailField");
      expect(ui?.content).toContain("SelectField");
    });

    test("should contain theme documentation", () => {
      expect(ui?.content).toContain("useTheme");
      expect(ui?.content).toContain("TerrenoProvider");
    });

    test("should contain modal documentation", () => {
      expect(ui?.content).toContain("Modal");
      expect(ui?.content).toContain("ActionSheet");
    });
  });

  describe("rtk resource", () => {
    const rtk = resources.find((r) => r.uri === "terreno://docs/rtk");

    test("should contain RTK Query setup", () => {
      expect(rtk?.content).toContain("emptyApi");
      expect(rtk?.content).toContain("RTK Query");
    });

    test("should contain auth documentation", () => {
      expect(rtk?.content).toContain("authSlice");
      expect(rtk?.content).toContain("useEmailLoginMutation");
    });

    test("should contain token documentation", () => {
      expect(rtk?.content).toContain("token");
      expect(rtk?.content).toContain("refresh");
    });
  });

  describe("patterns resource", () => {
    const patterns = resources.find((r) => r.uri === "terreno://docs/patterns");

    test("should contain backend patterns", () => {
      expect(patterns?.content).toContain("Model Definition");
      expect(patterns?.content).toContain("Route Setup");
    });

    test("should contain frontend patterns", () => {
      expect(patterns?.content).toContain("Screen");
      expect(patterns?.content).toContain("Form");
    });

    test("should contain error handling patterns", () => {
      expect(patterns?.content).toContain("Error Handling");
      expect(patterns?.content).toContain("APIError");
    });
  });
});
