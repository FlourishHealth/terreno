/**
 * Single source of truth for mapping an issue form's "Affected package"
 * dropdown onto an `area:*` label.
 *
 * `.github/workflows/triage.yml` runs this module rather than carrying its own
 * copy of the table, so the two cannot drift.
 */
export const AREA_BY_PACKAGE: Record<string, string> = {
  docs: "area:docs",
  examples: "area:examples",
  mcp: "area:mcp",
  "@terreno/admin-backend": "area:admin",
  "@terreno/admin-frontend": "area:admin",
  "@terreno/admin-spa": "area:admin",
  "@terreno/ai": "area:ai",
  "@terreno/api": "area:api",
  "@terreno/api-health": "area:api",
  "@terreno/feature-flags": "area:api",
  "@terreno/comms": "area:api",
  "@terreno/mcp": "area:mcp",
  "@terreno/rtk": "area:syncdb",
  "@terreno/syncdb": "area:syncdb",
  "@terreno/test": "area:api",
  "@terreno/ui": "area:ui",
};

export const parsePackageAreaFromIssueBody = (body: string): string | null => {
  const packageSection = body.match(/### Affected package\s*\n+([^\n#]+)/i);
  if (packageSection === null) {
    return null;
  }

  const value = packageSection[1]?.trim() ?? "";
  return AREA_BY_PACKAGE[value] ?? null;
};

/**
 * Writes `area=<label>` to the file named by GITHUB_OUTPUT so the triage
 * workflow can read it in a later step. An unrecognized package yields an
 * empty value, which the workflow treats as "ask the reporter".
 */
export const main = async (): Promise<void> => {
  const body = process.env.ISSUE_BODY ?? "";
  const outputPath = process.env.GITHUB_OUTPUT;
  const area = parsePackageAreaFromIssueBody(body) ?? "";

  if (outputPath === undefined || outputPath === "") {
    console.info(area);
    return;
  }

  await Bun.write(Bun.file(outputPath), `${await readExisting(outputPath)}area=${area}\n`);
  console.info(`Resolved area label: ${area === "" ? "(none)" : area}`);
};

const readExisting = async (path: string): Promise<string> => {
  const file = Bun.file(path);
  return (await file.exists()) ? file.text() : "";
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
