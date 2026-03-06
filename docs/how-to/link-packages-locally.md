# Link Terreno Packages Locally

Develop against local copies of Terreno packages in your consumer app using Bun's link feature.

## Overview

Consumers (e.g. [Flourish](https://github.com/FlourishHealth/flourish)) can link one or more Terreno packages—`@terreno/api`, `@terreno/ui`, `@terreno/rtk`—to test changes before they're published.

## Which Package Goes Where

- **@terreno/api** — Link in the consumer's backend (e.g. `backend/package.json`). Restart the server after changes.
- **@terreno/ui** — Link in the consumer's frontend app (e.g. `app/package.json`). Requires Metro config changes for Expo apps.
- **@terreno/rtk** — Link in the consumer's frontend app. May need Metro config tweaks if using with ui.

## Setup in Consumer Repo

### 1. Clone Both Repos

Place terreno next to the consumer repo (e.g. `flourish` and `terreno` as siblings):

````bash
cd ~/projects
git clone git@github.com:FlourishHealth/terreno.git
git clone git@github.com:YourOrg/your-app.git
````

### 2. Declare the Link

In the consumer's `package.json` (in the workspace that depends on the package), use the `link:` protocol:

````json
{
  "dependencies": {
    "@terreno/api": "link:../../terreno/api",
    "@terreno/ui": "link:../../terreno/ui",
    "@terreno/rtk": "link:../../terreno/rtk"
  }
}
````

Adjust paths to resolve from that `package.json` to the terreno package directory.

### 3. Register and Link

For each package, from the consumer repo:

````bash
cd ../terreno/<package-dir> && bun link && cd - && cd <consumer-dir> && bun link @terreno/<name>
````

**Example for ui** when consumer app is in `app/`:

````bash
cd ../terreno/ui && bun link && cd - && cd app && bun link @terreno/ui
````

Repeat for api (from backend dir) and rtk (from app dir). Or use consumer repo scripts if available (e.g. `bun run link:ui`).

### 4. Fix Symlinks (If Needed)

If Bun creates a bad relative symlink, replace it with an absolute path:

````bash
rm node_modules/@terreno/<name>
ln -s /absolute/path/to/terreno/<package-dir> node_modules/@terreno/<name>
````

### 5. Metro Config (Expo / React Native)

When linking **@terreno/ui** or **@terreno/rtk** in an Expo/Metro app, update the consumer's Metro config:

- Add the linked package directory to `watchFolders`
- Configure resolver to use app's `node_modules` for all dependencies
- Add `resolveRequest` fallback for bare imports from linked path

**Example** (`app/metro.config.js`):

````javascript
const {getDefaultConfig} = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add terreno packages to watch folders
config.watchFolders = [
  path.resolve(__dirname, '../../terreno/ui'),
  path.resolve(__dirname, '../../terreno/rtk'),
];

// Resolve all dependencies from app's node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Fallback for bare imports from linked packages
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath.includes('terreno')) {
    return context.resolveRequest(
      {...context, originModulePath: __dirname},
      moduleName,
      platform
    );
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
````

See existing consumer repos (e.g. Flourish) for working examples.

### 6. Restart Dev Servers

After linking or Metro config changes:

````bash
# Frontend (with clean cache)
bun start --clear

# Backend
bun run dev
````

## Working in Terreno Repo

Run compile or dev mode for each linked package so consumers see changes:

````bash
# API package
bun run api:compile  # or api:dev

# UI package
bun run ui:compile   # or ui:dev

# RTK package
bun run rtk:compile  # or rtk:dev
````

The consumer will use the built output from `dist/`.

## Reverting to Published Packages

In consumer's `package.json`, change link back to version:

````json
{
  "dependencies": {
    "@terreno/ui": "0.0.17"
  }
}
````

Then run `bun install` in that workspace.

## Troubleshooting

### Metro can't resolve dependencies

- Verify `watchFolders` includes linked package paths
- Check `nodeModulesPaths` points to app's `node_modules`
- Ensure `resolveRequest` fallback is configured
- Clear Metro cache: `bun start --clear`

### Backend doesn't pick up changes

- Restart the API server after modifying @terreno/api
- Ensure `bun run api:compile` or `api:dev` is running in terreno

### TypeScript errors

- Run `bun run compile` in both terreno and consumer repos
- Check that tsconfig paths align with link structure
