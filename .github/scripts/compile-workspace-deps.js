/**
 * Recursively compiles @terreno/* monorepo dependencies for the current package.
 *
 * During tag publish, workspace:* refs are replaced with semver before install.
 * Dependencies must still be compiled from sibling packages in this checkout
 * (npm installs do not include TypeScript sources for compile).
 *
 * Usage (from a package directory):
 *   node ../.github/scripts/compile-workspace-deps.js
 */
const fs = require("fs");
const path = require("path");
const {execSync} = require("child_process");

const DEP_TYPES = ["dependencies", "devDependencies", "peerDependencies"];
const compiled = new Set();

const isTerrenoMonorepoDep = (name) => name.startsWith("@terreno/");

const PACKAGE_DIR_ALIASES = {
  "@terreno/mcp": "mcp-server",
};

const resolveMonorepoPackageDir = (fromDir, packageName) => {
  const slug = PACKAGE_DIR_ALIASES[packageName] ?? packageName.replace("@terreno/", "");
  const relative = path.join(fromDir, "..", slug);
  const resolved = path.resolve(relative);
  const pkgPath = path.join(resolved, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return null;
  }
  return resolved;
};

const compile = (dir) => {
  const resolved = path.resolve(dir);
  if (compiled.has(resolved)) {
    return;
  }
  compiled.add(resolved);

  const pkgPath = path.join(resolved, "package.json");
  const depPkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  for (const t of DEP_TYPES) {
    for (const [name] of Object.entries(depPkg[t] || {})) {
      if (!isTerrenoMonorepoDep(name)) {
        continue;
      }
      const depDir = resolveMonorepoPackageDir(resolved, name);
      if (depDir) {
        compile(depDir);
      }
    }
  }

  console.log(`Compiling ${depPkg.name} (${resolved})`);
  execSync("bun tsc", {cwd: resolved, stdio: "inherit"});
};

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const t of DEP_TYPES) {
  for (const [name] of Object.entries(pkg[t] || {})) {
    if (!isTerrenoMonorepoDep(name)) {
      continue;
    }
    const depDir = resolveMonorepoPackageDir(process.cwd(), name);
    if (depDir) {
      compile(depDir);
    }
  }
}

if (compiled.size === 0) {
  console.log("No @terreno monorepo dependencies to compile");
} else {
  console.log(`Compiled ${compiled.size} @terreno monorepo dependency(ies)`);
}
