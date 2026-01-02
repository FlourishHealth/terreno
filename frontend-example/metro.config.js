const {getDefaultConfig} = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Only list the packages within your monorepo that your app uses. No need to add anything else.
// If your monorepo tooling can give you the list of monorepo workspaces linked
// in your app workspace, you can automate this list instead of hardcoding them.
const monorepoPackages = {
  "@terreno/ui": path.resolve(monorepoRoot, "ui"),
};

// 1. Watch the local app folder, and only the shared packages (limiting the scope and speeding it
// up) Note how we change this from `monorepoRoot` to `projectRoot`. This is part of the
// optimization!
config.watchFolders = [projectRoot, ...Object.values(monorepoPackages), monorepoRoot];

// Resolve symlinks to get actual paths for shared dependencies
// This ensures Metro treats all imports as the same module regardless of where they're imported from
const resolveSymlink = (modulePath) => {
  try {
    return fs.realpathSync(modulePath);
  } catch {
    return modulePath;
  }
};

// Ensure all packages use the same React instance to avoid "Invalid hook call" errors
// Use realpath to resolve through symlinks to the actual .bun cache location
const sharedDependencies = {
  react: resolveSymlink(path.resolve(projectRoot, "node_modules/react")),
  "react-dom": resolveSymlink(path.resolve(projectRoot, "node_modules/react-dom")),
  "react-native": resolveSymlink(path.resolve(projectRoot, "node_modules/react-native")),
  "react-native-web": resolveSymlink(path.resolve(projectRoot, "node_modules/react-native-web")),
};

// Add the monorepo workspaces as `extraNodeModules` to Metro.
// If your monorepo tooling creates workspace symlinks in the `node_modules` folder,
// you can either add symlink support to Metro or set the `extraNodeModules` to avoid the symlinks.
// See: https://metrobundler.dev/docs/configuration/#extranodemodules
config.resolver.extraNodeModules = {
  ...sharedDependencies,
  ...monorepoPackages,
};

// 2. Let Metro know where to resolve packages and in what order
// Include both bun's hoisted node_modules and local node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Enable symlinks for bun workspaces
config.resolver.unstable_enableSymlinks = true;

// Force React-related imports to resolve to a single canonical path
// This prevents the "Invalid hook call" error caused by duplicate React instances
const reactPackages = ["react", "react-dom", "react-native", "react-native-web"];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Exclude @sentry/react-native from web builds (it uses import.meta which isn't supported)
  // Keep this in case a transitive dependency tries to import it
  if (platform === "web" && (moduleName === "@sentry/react-native" || moduleName.startsWith("@sentry/react-native/"))) {
    return {
      type: "empty",
    };
  }

  // Check if this is a React-related import
  const packageName = reactPackages.find(
    (pkg) => moduleName === pkg || moduleName.startsWith(pkg + "/")
  );

  if (packageName && sharedDependencies[packageName]) {
    // Redirect to the canonical path
    const newContext = {
      ...context,
      originModulePath: path.resolve(projectRoot, "index.js"),
    };
    return context.resolveRequest(newContext, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
