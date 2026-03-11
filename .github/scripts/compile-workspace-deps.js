/**
 * Recursively compiles all workspace:* dependencies for the current package.
 *
 * Reads package.json in the current directory, finds all @terreno/* workspace
 * dependencies, resolves their transitive workspace deps (depth-first), and
 * compiles each one exactly once via `bun tsc`.
 *
 * Usage (from a package directory):
 *   node ../.github/scripts/compile-workspace-deps.js
 */
const fs = require("fs");
const path = require("path");
const {execSync} = require("child_process");

const DEP_TYPES = ["dependencies", "devDependencies", "peerDependencies"];
const compiled = new Set();

const compile = (dir) => {
  const resolved = path.resolve(dir);
  if (compiled.has(resolved)) {
    return;
  }
  compiled.add(resolved);

  const pkgPath = path.join(resolved, "package.json");
  const depPkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  // Compile transitive workspace deps first
  for (const t of DEP_TYPES) {
    for (const [name, version] of Object.entries(depPkg[t] || {})) {
      if (version === "workspace:*" && name.startsWith("@terreno/")) {
        const depDir = path.join(resolved, "..", name.replace("@terreno/", ""));
        compile(depDir);
      }
    }
  }

  console.log(`Compiling ${depPkg.name} (${resolved})`);
  execSync("bun tsc", {cwd: resolved, stdio: "inherit"});
};

// Read the current package and compile its workspace deps
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
for (const t of DEP_TYPES) {
  for (const [name, version] of Object.entries(pkg[t] || {})) {
    if (version === "workspace:*" && name.startsWith("@terreno/")) {
      const depDir = path.join("..", name.replace("@terreno/", ""));
      compile(depDir);
    }
  }
}

if (compiled.size === 0) {
  console.log("No workspace dependencies to compile");
} else {
  console.log(`Compiled ${compiled.size} workspace dependency(ies)`);
}
