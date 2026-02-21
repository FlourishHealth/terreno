import {describe, expect, it} from "bun:test";
import {existsSync} from "fs";
import {join} from "path";

const TYPES_FILE_PATH = join(__dirname, "ui-types-documentation.json");

/**
 * Helper to ensure the types file exists before running tests.
 * This is needed because the file is gitignored and may not exist.
 */
const ensureTypesFileExists = async (): Promise<void> => {
  if (!existsSync(TYPES_FILE_PATH)) {
    const proc = Bun.spawn(["bun", "run", "generate-types"], {
      cwd: __dirname,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
  }
};

describe("generate-types", () => {
  it("should generate the ui-types-documentation.json file", async () => {
    // First, delete the file if it exists to test generation
    if (existsSync(TYPES_FILE_PATH)) {
      await Bun.write(TYPES_FILE_PATH + ".bak", await Bun.file(TYPES_FILE_PATH).text());
    }

    // Run the generate-types script
    const proc = Bun.spawn(["bun", "run", "generate-types"], {
      cwd: __dirname,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    // Check that the command succeeded
    expect(exitCode).toBe(0);

    // Check that the file was created
    expect(existsSync(TYPES_FILE_PATH)).toBe(true);
  });

  it("should generate valid JSON", async () => {
    await ensureTypesFileExists();

    const content = await Bun.file(TYPES_FILE_PATH).text();

    // Should not throw when parsing
    let parsed: unknown;
    expect(() => {
      parsed = JSON.parse(content);
    }).not.toThrow();

    expect(parsed).toBeDefined();
  });

  it("should have the expected top-level structure", async () => {
    await ensureTypesFileExists();

    const content = await Bun.file(TYPES_FILE_PATH).text();
    const parsed = JSON.parse(content);

    // TypeDoc output should have specific top-level properties
    expect(parsed).toHaveProperty("schemaVersion");
    expect(parsed).toHaveProperty("name", "@terreno/ui");
    expect(parsed).toHaveProperty("kind");
    expect(parsed).toHaveProperty("children");
    expect(Array.isArray(parsed.children)).toBe(true);
  });

  it("should contain Common and CommonIconTypes modules", async () => {
    await ensureTypesFileExists();

    const content = await Bun.file(TYPES_FILE_PATH).text();
    const parsed = JSON.parse(content);

    // The top-level children should be the entry point modules from typedoc.json
    const moduleNames = parsed.children.map((child: {name: string}) => child.name);

    expect(moduleNames).toContain("Common");
    expect(moduleNames).toContain("CommonIconTypes");
  });

  it("should contain UI component prop interfaces inside Common module", async () => {
    await ensureTypesFileExists();

    const content = await Bun.file(TYPES_FILE_PATH).text();
    const parsed = JSON.parse(content);

    // Find the Common module
    const commonModule = parsed.children.find((child: {name: string}) => child.name === "Common");
    expect(commonModule).toBeDefined();
    expect(commonModule.children).toBeDefined();
    expect(Array.isArray(commonModule.children)).toBe(true);

    // Get all interface names from the Common module
    const interfaceNames = commonModule.children.map((child: {name: string}) => child.name);

    // Should contain prop interfaces from @terreno/ui
    // These are referenced in demoConfig.tsx via interfaceName property
    const expectedInterfaces = [
      "ButtonProps",
      "TextProps",
      "BoxProps",
      "ModalProps",
      "TextFieldProps",
      "AccordionProps",
      "AvatarProps",
      "BadgeProps",
    ];

    for (const expectedInterface of expectedInterfaces) {
      expect(interfaceNames).toContain(expectedInterface);
    }
  });

  it("should have proper interface structure with name and kind", async () => {
    await ensureTypesFileExists();

    const content = await Bun.file(TYPES_FILE_PATH).text();
    const parsed = JSON.parse(content);

    // Find the Common module
    const commonModule = parsed.children.find((child: {name: string}) => child.name === "Common");

    // Each child should have at least name and kind properties (TypeDoc structure)
    for (const child of commonModule.children) {
      expect(child).toHaveProperty("name");
      expect(typeof child.name).toBe("string");
      expect(child).toHaveProperty("kind");
      expect(typeof child.kind).toBe("number");
    }
  });

  it("should include property documentation for interfaces", async () => {
    await ensureTypesFileExists();

    const content = await Bun.file(TYPES_FILE_PATH).text();
    const parsed = JSON.parse(content);

    // Find the Common module and then ButtonProps
    const commonModule = parsed.children.find((child: {name: string}) => child.name === "Common");
    const buttonProps = commonModule.children.find(
      (child: {name: string}) => child.name === "ButtonProps"
    );

    expect(buttonProps).toBeDefined();
    // ButtonProps should have children (its properties)
    expect(buttonProps.children).toBeDefined();
    expect(Array.isArray(buttonProps.children)).toBe(true);
    expect(buttonProps.children.length).toBeGreaterThan(0);

    // Each property should have a name
    for (const prop of buttonProps.children) {
      expect(prop).toHaveProperty("name");
      expect(typeof prop.name).toBe("string");
    }
  });
});
