import type {Tool} from "@modelcontextprotocol/sdk/types.js";

export const bootstrapTools: Tool[] = [
  {
    description:
      "Bootstrap a new Terreno full-stack application with frontend (Expo/React Native) and backend (Express/Mongoose) directories, including Cursor rules and MCP settings",
    inputSchema: {
      properties: {
        appDisplayName: {
          description: "Human-readable display name (e.g., 'My Todo App', 'Task Manager')",
          type: "string",
        },
        appName: {
          description:
            "The application name in kebab-case (e.g., 'my-app', 'todo-app'). Used for directory names and package names.",
          type: "string",
        },
        description: {
          description: "A brief description of the app (optional)",
          type: "string",
        },
        mcpServerUrl: {
          default: "https://mcp.terreno.flourish.health",
          description: "URL of the Terreno MCP server for AI assistance",
          type: "string",
        },
      },
      required: ["appName", "appDisplayName"],
      type: "object",
    },
    name: "bootstrap_app",
  },
  {
    description:
      "Bootstrap AI coding assistant rules for a Terreno project. Creates configuration files for Cursor, Windsurf, Claude Code, and GitHub Copilot with Terreno-specific guidelines adapted for the project.",
    inputSchema: {
      properties: {
        appDisplayName: {
          description: "Human-readable display name (e.g., 'My Todo App', 'Task Manager')",
          type: "string",
        },
        appName: {
          description:
            "The application name in kebab-case (e.g., 'my-app', 'todo-app'). Used in rule file headers.",
          type: "string",
        },
        description: {
          description: "A brief description of the app (optional)",
          type: "string",
        },
      },
      required: ["appName", "appDisplayName"],
      type: "object",
    },
    name: "bootstrap_ai_rules",
  },
];

interface BootstrapArgs {
  appName: string;
  appDisplayName: string;
  description?: string;
  mcpServerUrl?: string;
}

const _toPascalCase = (str: string): string => {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

const generateCursorRules = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `# ${appDisplayName}

A full-stack application built with the Terreno framework.

## Project Structure

- **frontend/** - Expo/React Native frontend using @terreno/ui and @terreno/rtk
- **backend/** - Express/Mongoose backend using @terreno/api

## Development

Uses [Bun](https://bun.sh/) as the package manager.

\`\`\`bash
# Backend
cd backend && bun run dev    # Start backend on port 4000

# Frontend
cd frontend && bun run web   # Start web frontend
cd frontend && bun run sdk   # Regenerate SDK after backend changes
\`\`\`

## Code Style

### TypeScript/JavaScript
- Use ES module syntax and TypeScript for all code
- Prefer interfaces over types; avoid enums, use maps
- Prefer const arrow functions over \`function\` keyword
- Use descriptive variable names with auxiliary verbs (e.g., \`isLoading\`)
- Favor named exports
- Use the RORO pattern (Receive an Object, Return an Object)

### Dates and Time
- Always use Luxon instead of Date or dayjs

### Error Handling
- Check error conditions at start of functions and return early
- Limit nested if statements
- Use multiline syntax with curly braces for all conditionals

### React Best Practices
- Use functional components with \`React.FC\` type
- Add explanatory comment above each \`useEffect\`
- Wrap callbacks in \`useCallback\`
- Use Redux Toolkit for state management

### Backend Conventions
- Use \`modelRouter\` for CRUD endpoints
- Use \`APIError\` for error responses
- Use \`logger.info/warn/error/debug\` for logging
- Use \`Model.findExactlyOne\` or \`Model.findOneOrNone\` (not \`Model.findOne\`)

### Frontend Conventions
- Use generated SDK hooks from \`@/store/openApiSdk\`
- Use @terreno/ui components (Box, Page, Button, TextField, etc.)
- Never modify \`openApiSdk.ts\` manually - regenerate with \`bun run sdk\`

## AI Assistance

This project is configured to use the Terreno MCP server for AI-assisted development.
Use the MCP tools and prompts for:
- Generating new models and routes
- Creating screens and forms
- Following Terreno patterns and best practices
`;
};

const generateMcpSettings = (args: BootstrapArgs): string => {
  const mcpUrl = args.mcpServerUrl || "https://mcp.terreno.flourish.health";
  return JSON.stringify(
    {
      mcpServers: {
        terreno: {
          type: "http",
          url: `${mcpUrl}/mcp`,
        },
      },
    },
    null,
    2
  );
};

const generateClaudeMd = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `# ${appDisplayName}

A full-stack application built with the Terreno framework.

## Project Structure

- **frontend/** - Expo/React Native frontend
- **backend/** - Express/Mongoose backend

## Development

\`\`\`bash
# Install dependencies
cd backend && bun install
cd frontend && bun install

# Start backend (port 4000)
cd backend && bun run dev

# Start frontend (port 8082)
cd frontend && bun run web

# Regenerate SDK after backend changes
cd frontend && bun run sdk
\`\`\`

## Adding Features

1. Create model in \`backend/src/models/\`
2. Create route in \`backend/src/api/\`
3. Register route in \`backend/src/server.ts\`
4. Regenerate SDK: \`cd frontend && bun run sdk\`
5. Create screens in \`frontend/app/\`

## Code Style

- Use TypeScript with ES modules
- Use Luxon for dates
- Prefer const arrow functions
- Named exports preferred
- Use interfaces over types
`;
};

// Backend file generators
const generateBackendPackageJson = (args: BootstrapArgs): string => {
  const {appName} = args;
  return JSON.stringify(
    {
      dependencies: {
        "@terreno/api": "latest",
        dotenv: "^16.4.7",
        luxon: "^3.7.2",
        mongoose: "^8.18.1",
        "passport-local-mongoose": "^9.0.1",
      },
      devDependencies: {
        "@biomejs/biome": "^2.3.6",
        "@types/bun": "^1.2.4",
        "@types/express": "^4.17.21",
        "@types/luxon": "^3.7.1",
        "@types/passport-local-mongoose": "^6.1.5",
        typescript: "~5.9.2",
      },
      name: `@${appName}/backend`,
      private: true,
      scripts: {
        build: "bun build src/index.ts --outdir ./dist --target node",
        compile: "tsc",
        dev: "PORT=4000 bun run --watch src/index.ts",
        format: "biome format --write .",
        lint: "biome check .",
        "lint:fix": "biome check --write .",
        "lint:unsafefix": "biome check --write . --unsafe",
        start: "bun run src/index.ts",
        test: "bun test",
      },
      type: "module",
      version: "1.0.0",
    },
    null,
    2
  );
};

const generateBackendTsConfig = (): string => {
  return JSON.stringify(
    {
      compilerOptions: {
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        lib: ["ESNext"],
        module: "ESNext",
        moduleResolution: "bundler",
        noEmit: true,
        outDir: "./dist",
        resolveJsonModule: true,
        skipLibCheck: true,
        strict: true,
        target: "ESNext",
        types: ["bun-types"],
      },
      exclude: ["node_modules", "dist"],
      include: ["src/**/*"],
    },
    null,
    2
  );
};

const generateBackendBiomeJsonc = (): string => {
  return `{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on",
        "useSortedAttributes": "on",
        "useSortedKeys": "on"
      }
    },
    "enabled": true
  },
  "files": {
    "includes": [
      "package.json",
      "src/**/*.ts",
      "src/**/*.tsx",
      "!!**/node_modules",
      "!!**/dist",
      "!!**/build",
      "!!**/coverage",
      "!!**/.git"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "arrowParentheses": "always",
      "bracketSpacing": false,
      "jsxQuoteStyle": "double",
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "es5"
    },
    // TODO: Remove once we don't need to import React from 'react' in our JSX files.
    "jsxRuntime": "reactClassic"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "nursery": {
        "noFloatingPromises": "error",
        "noMisusedPromises": "error",
        "useExhaustiveSwitchCases": "error"
      },
      "recommended": true,
      "suspicious": {
        "noConsole": {
          "level": "error",
          "options": {
            "allow": ["assert", "debug", "error", "info", "warn"]
          }
        },
        "noExplicitAny": "off",
        "noImplicitAnyLet": "off"
      }
    }
  },
  "vcs": {
    "clientKind": "git",
    "defaultBranch": "master",
    "enabled": true
  }
}
`;
};

const generateBackendIndex = (): string => {
  return `import "./server";
`;
};

const generateBackendServer = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `import {type AddRoutes, checkModelsStrict, logger, setupServer} from "@terreno/api";
import {addUserRoutes} from "./api/users";
import {User} from "./models/user";
import {connectToMongoDB} from "./utils/database";

const isDeployed = process.env.NODE_ENV === "production";

const addMiddleware: AddRoutes = (_router, _options) => {
  // Add middleware here
};

const addRoutes: AddRoutes = (router, options): void => {
  // Add API routes
  addUserRoutes(router, options);
};

export async function start(skipListen = false): Promise<ReturnType<typeof setupServer>> {
  await connectToMongoDB();

  logger.info(\`Starting ${appDisplayName} server on port \${process.env.PORT || 4000}\`);

  if (!isDeployed) {
    checkModelsStrict();
  }

  const app = setupServer({
    addMiddleware,
    addRoutes,
    loggingOptions: {
      disableConsoleColors: isDeployed,
      level: "debug",
      logRequests: !isDeployed,
    },
    skipListen,
    // biome-ignore lint/suspicious/noExplicitAny: Typing User model
    userModel: User as any,
  });

  return app;
}

start().catch((error) => {
  logger.error(\`Fatal error starting server: \${error}\`);
});
`;
};

const generateBackendDatabase = (args: BootstrapArgs): string => {
  const {appName} = args;
  const dbName = appName.replace(/-/g, "_");
  return `import {logger} from "@terreno/api";
import mongoose from "mongoose";

export const connectToMongoDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    logger.info("Already connected to MongoDB");
    return;
  }

  const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/${dbName}";

  try {
    await mongoose.connect(mongoURI);
    logger.info("Connected to MongoDB");
  } catch (error: unknown) {
    logger.error(\`MongoDB connection error: \${error}\`);
    throw error;
  }

  mongoose.connection.on("error", (error: unknown) => {
    logger.error(\`MongoDB connection error: \${error}\`);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
};
`;
};

const generateBackendModelPlugins = (): string => {
  return `import {
  createdUpdatedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
} from "@terreno/api";
import type mongoose from "mongoose";

// biome-ignore lint/suspicious/noExplicitAny: Leaving open for flexibility
export function addDefaultPlugins(schema: mongoose.Schema<any, any, any, any>): void {
  schema.plugin(createdUpdatedPlugin);
  schema.plugin(isDeletedPlugin);
  schema.plugin(findOneOrNone);
  schema.plugin(findExactlyOne);
}
`;
};

const generateBackendUserModel = (): string => {
  return `import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import type {UserDocument, UserModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

const userSchema = new mongoose.Schema<UserDocument, UserModel>(
  {
    admin: {
      default: false,
      type: Boolean,
    },
    email: {
      lowercase: true,
      required: true,
      trim: true,
      type: String,
      unique: true,
    },
    name: {
      required: true,
      trim: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

userSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
});

addDefaultPlugins(userSchema);

userSchema.method("getDisplayName", function (this: UserDocument): string {
  return this.name;
});

export const User = mongoose.model<UserDocument, UserModel>("User", userSchema);

User.findByEmail = async function (email: string): Promise<UserDocument | null> {
  return this.findOneOrNone({email: email.toLowerCase()});
};
`;
};

const generateBackendModelsIndex = (): string => {
  return `export * from "./user";
`;
};

const generateBackendUserRoutes = (): string => {
  return `import {Permissions, type ModelRouterOptions, modelRouter} from "@terreno/api";
import type {Router} from "express";
import {User} from "../models";
import type {UserDocument} from "../types";

export const addUserRoutes = (
  router: Router,
  options?: Partial<ModelRouterOptions<UserDocument>>
): void => {
  router.use(
    "/users",
    modelRouter(User, {
      ...options,
      permissions: {
        create: [Permissions.IsAdmin],
        delete: [Permissions.IsAdmin],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsAuthenticated],
        update: [Permissions.IsAdmin],
      },
      queryFields: ["email", "name"],
      sort: "name",
    })
  );
};
`;
};

const generateBackendTypes = (): string => {
  return `export * from "./models";
`;
};

const generateBackendTypesModels = (): string => {
  return `export * from "./userTypes";
`;
};

const generateBackendUserTypes = (): string => {
  return `/// <reference types="passport-local-mongoose" />
import type {APIErrorConstructor} from "@terreno/api";
import type mongoose from "mongoose";
import type {Document, FilterQuery, Model} from "mongoose";

export interface DefaultStatics<T> {
  findOneOrNone(
    query: FilterQuery<T>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<(Document & T) | null>;

  findExactlyOne(
    query: FilterQuery<T>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<Document & T>;
}

export interface DefaultPluginFields {
  created: Date;
  updated: Date;
  deleted: boolean;
}

export type DefaultModel<T> = Model<T & DefaultPluginFields> & DefaultStatics<T>;
export type DefaultDoc = mongoose.Document<mongoose.Types.ObjectId> & DefaultPluginFields;

export type UserMethods = {
  getDisplayName: (this: UserDocument) => string;
};

export type UserStatics = DefaultStatics<UserDocument> & {
  findByEmail: (this: UserModel, email: string) => Promise<UserDocument | null>;
};

export type UserModel = DefaultModel<UserDocument> &
  UserStatics &
  mongoose.PassportLocalModel<UserDocument>;

export type UserSchema = mongoose.Schema<UserDocument, UserModel, UserMethods>;

export type UserDocument = DefaultDoc &
  UserMethods &
  mongoose.PassportLocalDocument & {
    admin: boolean;
    email: string;
    name: string;
  };
`;
};

// Frontend file generators
const generateFrontendPackageJson = (args: BootstrapArgs): string => {
  const {appName} = args;
  return JSON.stringify(
    {
      dependencies: {
        "@react-navigation/native": "^7.1.8",
        "@sentry/react": "^10.29.0",
        "@terreno/rtk": "latest",
        "@terreno/ui": "latest",
        "expo": "~54.0.29",
        "react": "19.1.0",
        "react-dom": "19.1.0",
        "react-native": "0.81.5",
        "react-redux": "^9.2.0"
      },
      devDependencies: {
        "@biomejs/biome": "^2.3.6",
        "@playwright/test": "^1.58.2",
        "@types/react": "~19.1.10",
        typescript: "~5.9.2",
      },
      main: "expo-router/entry",
      name: `@${appName}/frontend`,
      private: true,
      scripts: {
        android: "bun expo start --android --port 8082",
        ios: "bun expo start --ios --port 8082",
        lint: "bun biome check .",
        "lint:fix": "bun biome check --write .",
        "lint:unsafefix": "biome check --write . --unsafe",
        sdk: "bun scripts/generate-sdk.ts && bun biome check --write scripts/generate-sdk.ts",
        start: "bun expo start --port 8082",
        test: "bun test",
        web: "bun expo start --web --port 8082",
      },
      version: "1.0.0",
    },
    null,
    2
  );
};

const generateFrontendAppJson = (args: BootstrapArgs): string => {
  const {appDisplayName, appName} = args;
  return JSON.stringify(
    {
      expo: {
        android: {
          adaptiveIcon: {
            backgroundColor: "#ffffff",
            foregroundImage: "./assets/images/adaptive-icon.png",
          },
        },
        experiments: {
          typedRoutes: true,
        },
        icon: "./assets/images/icon.png",
        ios: {
          supportsTablet: true,
        },
        name: appDisplayName,
        newArchEnabled: true,
        orientation: "portrait",
        plugins: ["expo-router"],
        scheme: appName,
        slug: appName,
        splash: {
          backgroundColor: "#ffffff",
          image: "./assets/images/splash-icon.png",
          resizeMode: "contain",
        },
        userInterfaceStyle: "automatic",
        version: "1.0.0",
        web: {
          bundler: "metro",
          favicon: "./assets/images/favicon.png",
          output: "static",
        },
      },
    },
    null,
    2
  );
};

const generateFrontendTsConfig = (): string => {
  return JSON.stringify(
    {
      compilerOptions: {
        allowJs: true,
        allowSyntheticDefaultImports: true,
        baseUrl: ".",
        esModuleInterop: true,
        jsx: "react-jsx",
        lib: ["DOM", "ESNext"],
        module: "esnext",
        moduleResolution: "bundler",
        noEmit: true,
        paths: {
          "@/*": ["./*"],
          "@components/*": ["./components/*"],
          "@store": ["./store/index"],
          "@store/*": ["./store/*"],
          "@utils": ["./utils/index"],
          "@utils/*": ["./utils/*"],
        },
        resolveJsonModule: true,
        skipLibCheck: true,
        strict: true,
        target: "ESNext",
        types: ["react-native", "@types/react"],
      },
      extends: "expo/tsconfig.base",
      include: ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
    },
    null,
    2
  );
};

const generateFrontendTsConfigCodegen = (): string => {
  return JSON.stringify(
    {
      compilerOptions: {
        esModuleInterop: true,
        module: "commonjs",
        moduleResolution: "node",
        resolveJsonModule: true,
        skipLibCheck: true,
        target: "ES2020",
      },
    },
    null,
    2
  );
};

const generateFrontendBiomeJsonc = (): string => {
  return `{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on",
        "useSortedAttributes": "on",
        "useSortedKeys": "on"
      }
    },
    "enabled": true
  },
  "files": {
    "includes": [
      "package.json",
      "app/**/*.ts",
      "app/**/*.tsx",
      "components/**/*.ts",
      "components/**/*.tsx",
      "store/**/*.ts",
      "store/**/*.tsx",
      "utils/**/*.ts",
      "utils/**/*.tsx",
      "constants/**/*.ts",
      "scripts/**/*.ts",
      "!!**/node_modules",
      "!!**/dist",
      "!!**/build",
      "!!**/coverage",
      "!!**/.expo",
      "!!**/.next",
      "!!**/generated",
      "!!**/.git"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "arrowParentheses": "always",
      "bracketSpacing": false,
      "jsxQuoteStyle": "double",
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "es5"
    },
    // TODO: Remove once we don't need to import React from 'react' in our JSX files.
    "jsxRuntime": "reactClassic"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "nursery": {
        "noFloatingPromises": "error",
        "noMisusedPromises": "error",
        "useExhaustiveSwitchCases": "error"
      },
      "recommended": true,
      "suspicious": {
        "noConsole": {
          "level": "error",
          "options": {
            "allow": ["assert", "debug", "error", "info", "warn"]
          }
        },
        "noExplicitAny": "off",
        "noImplicitAnyLet": "off"
      }
    }
  },
  "vcs": {
    "clientKind": "git",
    "defaultBranch": "master",
    "enabled": true
  }
}
`;
};

const generateFrontendOpenApiConfig = (): string => {
  return `import type {ConfigFile} from "@rtk-query/codegen-openapi";

const config: ConfigFile = {
  apiFile: "@terreno/rtk",
  apiImport: "emptySplitApi",
  argSuffix: "Args",
  exportName: "openapi",
  flattenArg: true,
  hooks: true,
  outputFile: "./store/openApiSdk.ts",
  responseSuffix: "Res",
  schemaFile: process.env.OPENAPI_URL ?? "http://localhost:4000/openapi.json",
  tag: true,
};

export default config;
`;
};

const generateFrontendGenerateSdk = (): string => {
  return `#!/usr/bin/env bun

import {exec} from "node:child_process";
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const cliPath = join(
  __dirname,
  "..",
  "node_modules",
  "@rtk-query",
  "codegen-openapi",
  "lib",
  "bin",
  "cli.mjs"
);
const configPath = join(__dirname, "..", "openapi-config.ts");
const tsConfigPath = join(__dirname, "..", "tsconfig.codegen.json");

const command = \`TS_NODE_PROJECT=\${tsConfigPath} tsx \${cliPath} \${configPath}\`;

exec(command, (error, _stdout, stderr) => {
  if (error) {
    console.error(\`Error: \${error.message}\`);
    process.exit(1);
  }
  if (stderr) {
    console.error(\`stderr: \${stderr}\`);
  }

  const sdkPath = join(__dirname, "..", "store", "openApiSdk.ts");

  if (existsSync(sdkPath)) {
    let content = readFileSync(sdkPath, "utf8");
    content = content.replace(/^export const \\{\\} = injectedRtkApi;\\n?/m, "");
    writeFileSync(sdkPath, content, "utf8");
  }

  exec(
    "bunx biome check --unsafe --write store/openApiSdk.ts",
    {cwd: join(__dirname, "..")},
    (formatError) => {
      if (formatError) {
        console.error(\`Formatting error: \${formatError.message}\`);
        process.exit(1);
      }
    }
  );
});
`;
};

const generateFrontendRootLayout = (_args: BootstrapArgs): string => {
  return `import FontAwesome from "@expo/vector-icons/FontAwesome";
import {DefaultTheme, ThemeProvider} from "@react-navigation/native";
import {useFonts} from "expo-font";
import {Stack} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {useEffect} from "react";
import "react-native-reanimated";
import {baseUrl, useSelectCurrentUserId} from "@terreno/rtk";
import {TerrenoProvider} from "@terreno/ui";
import {Provider} from "react-redux";
import {PersistGate} from "redux-persist/integration/react";
import store, {persistor} from "@/store";

export {ErrorBoundary} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.ReactElement | null {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Handle font loading errors
  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  // Hide splash screen when fonts are loaded
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <TerrenoProvider openAPISpecUrl={\`\${baseUrl}/openapi.json\`}>
          <RootLayoutNav />
        </TerrenoProvider>
      </PersistGate>
    </Provider>
  );
}

function RootLayoutNav(): React.ReactElement {
  const userId = useSelectCurrentUserId();

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        {!userId ? (
          <Stack.Screen name="login" options={{headerShown: false}} />
        ) : (
          <Stack.Screen name="(tabs)" options={{headerShown: false}} />
        )}
      </Stack>
    </ThemeProvider>
  );
}
`;
};

const generateFrontendLogin = (): string => {
  return `import {Box, Button, Heading, Page, Text, TextField, useToast} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {useEmailLoginMutation, useEmailSignUpMutation} from "@/store";

const LoginScreen: React.FC = () => {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const toast = useToast();

  const [emailLogin, {isLoading: isLoginLoading, error: loginError}] = useEmailLoginMutation();
  const [emailSignUp, {isLoading: isSignUpLoading, error: signUpError}] = useEmailSignUpMutation();

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!email || !password) {
      toast.warn("Email and password are required");
      return;
    }

    if (isSignUp && !name) {
      toast.warn("Signup requires name");
      return;
    }

    try {
      if (isSignUp) {
        await emailSignUp({email, name, password}).unwrap();
      } else {
        await emailLogin({email, password}).unwrap();
      }
    } catch (err) {
      console.error("Authentication error:", err);
    }
  }, [email, password, name, isSignUp, emailLogin, emailSignUp, toast]);

  const toggleMode = useCallback((): void => {
    setIsSignUp(!isSignUp);
  }, [isSignUp]);

  const isLoading = isLoginLoading || isSignUpLoading;
  const error = loginError || signUpError;
  const isSubmitDisabled = !email || !password || (isSignUp && !name) || isLoading;

  return (
    <Page navigation={undefined}>
      <Box
        alignItems="center"
        alignSelf="center"
        flex="grow"
        justifyContent="center"
        maxWidth={400}
        padding={4}
        width="100%"
      >
        <Box marginBottom={8}>
          <Heading>{isSignUp ? "Create Account" : "Welcome Back"}</Heading>
        </Box>
        <Box gap={4} width="100%">
          {isSignUp && (
            <TextField
              disabled={isLoading}
              onChange={setName}
              placeholder="Name"
              title="Name"
              value={name}
            />
          )}
          <TextField
            autoComplete="off"
            disabled={isLoading}
            onChange={setEmail}
            placeholder="Email"
            title="Email"
            type="email"
            value={email}
          />
          <TextField
            disabled={isLoading}
            onChange={setPassword}
            placeholder="Password"
            title="Password"
            type="password"
            value={password}
          />
          {Boolean(error) && (
            <Text color="error">
              {(error as {data?: {message?: string}})?.data?.message || "An error occurred"}
            </Text>
          )}
          <Box marginTop={4}>
            <Button
              disabled={isSubmitDisabled}
              fullWidth
              loading={isLoading}
              onClick={handleSubmit}
              text={isSignUp ? "Sign Up" : "Login"}
            />
          </Box>
          <Box marginTop={2}>
            <Button
              disabled={isLoading}
              fullWidth
              onClick={toggleMode}
              text={isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
              variant="outline"
            />
          </Box>
        </Box>
      </Box>
    </Page>
  );
};

export default LoginScreen;
`;
};

const generateFrontendTabsLayout = (): string => {
  return `import FontAwesome from "@expo/vector-icons/FontAwesome";
import {Tabs} from "expo-router";
import type React from "react";
import {colors} from "@/constants/theme";

const TabBarIcon: React.FC<{
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}> = ({name, color}) => {
  return <FontAwesome color={color} name={name} size={24} style={{marginBottom: -3}} />;
};

const TabLayout: React.FC = () => {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="home" />,
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({color}) => <TabBarIcon color={color} name="user" />,
          title: "Profile",
        }}
      />
    </Tabs>
  );
};

export default TabLayout;
`;
};

const generateFrontendTabsIndex = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `import {Box, Heading, Page, Text} from "@terreno/ui";
import type React from "react";

const HomeScreen: React.FC = () => {
  return (
    <Page navigation={undefined} title="Home">
      <Box padding={4} gap={4}>
        <Heading>Welcome to ${appDisplayName}</Heading>
        <Text>Your app is ready for development!</Text>
        <Text color="secondary">
          Start by adding models to the backend and screens to the frontend.
        </Text>
      </Box>
    </Page>
  );
};

export default HomeScreen;
`;
};

const generateFrontendTabsProfile = (): string => {
  return `import {Box, Button, Heading, Page, Text} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";
import {logout, useGetMeQuery} from "@/store";
import {useAppDispatch} from "@/store";

const ProfileScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const {data: profile, isLoading} = useGetMeQuery();

  const handleLogout = useCallback((): void => {
    dispatch(logout());
  }, [dispatch]);

  if (isLoading) {
    return (
      <Page navigation={undefined} title="Profile">
        <Box padding={4}>
          <Text>Loading...</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={undefined} title="Profile">
      <Box padding={4} gap={4}>
        <Heading>Profile</Heading>
        <Box gap={2}>
          <Text weight="bold">Name</Text>
          <Text>{profile?.data?.name || "Not set"}</Text>
        </Box>
        <Box gap={2}>
          <Text weight="bold">Email</Text>
          <Text>{profile?.data?.email || "Not set"}</Text>
        </Box>
        <Box marginTop={4}>
          <Button onClick={handleLogout} text="Logout" variant="outline" fullWidth />
        </Box>
      </Box>
    </Page>
  );
};

export default ProfileScreen;
`;
};

const generateFrontendNotFound = (): string => {
  return `import {Box, Text} from "@terreno/ui";
import {Link, Stack} from "expo-router";
import type React from "react";

const NotFoundScreen: React.FC = () => {
  return (
    <>
      <Stack.Screen options={{title: "Oops!"}} />
      <Box flex={1} alignItems="center" justifyContent="center" padding={4}>
        <Text size="lg" weight="bold">
          This screen doesn't exist.
        </Text>
        <Link href="/" style={{marginTop: 16}}>
          <Text color="link">Go to home screen</Text>
        </Link>
      </Box>
    </>
  );
};

export default NotFoundScreen;
`;
};

const generateFrontendStoreIndex = (): string => {
  return `import AsyncStorage from "@react-native-async-storage/async-storage";
import {combineReducers, configureStore} from "@reduxjs/toolkit";
import {generateAuthSlice} from "@terreno/rtk";
import {DateTime} from "luxon";
import {useDispatch} from "react-redux";
import type {Storage} from "redux-persist";
import {persistReducer, persistStore} from "redux-persist";

import appState from "./appState";
import {rtkQueryErrorMiddleware} from "./errors";
import {terrenoApi} from "./sdk";

export * from "./appState";
export {useSentryAndToast} from "./errors";

const authSlice = generateAuthSlice(terrenoApi);

export const {logout} = authSlice;

const createSafeStorage = (): Storage => {
  return {
    getItem: async (key: string): Promise<string | null> => {
      if (typeof window !== "undefined") {
        return AsyncStorage.getItem(key);
      }
      return null;
    },
    removeItem: async (key: string): Promise<void> => {
      if (typeof window !== "undefined") {
        return AsyncStorage.removeItem(key);
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      if (typeof window !== "undefined") {
        return AsyncStorage.setItem(key, value);
      }
    },
  };
};

const persistConfig = {
  blacklist: ["terreno-rtk"],
  key: "root",
  storage: createSafeStorage(),
  timeout: 0,
  version: 1,
};

const rootReducer = combineReducers({
  appState,
  auth: authSlice.authReducer,
  "terreno-rtk": terrenoApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  devTools: process.env.NODE_ENV !== "production" && {
    name: \`App-\${
      typeof window !== "undefined"
        // biome-ignore lint/suspicious/noAssignInExpressions: Window name assignment
        ? window.name || ((window.name = \`Window-\${DateTime.now().toFormat("HH:mm:ss")}\`))
        : "Unknown"
    }\`,
  },
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
      thunk: true,
    }).concat([
      ...authSlice.middleware,
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query middleware typing
      terrenoApi.middleware as any,
      rtkQueryErrorMiddleware,
      // biome-ignore lint/suspicious/noExplicitAny: Middleware array typing
    ]) as any;
  },
  reducer: persistedReducer,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export {useAppSelector} from "./appState";

export default store;
export * from "./sdk";
`;
};

const generateFrontendStoreAppState = (): string => {
  return `import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import type {RootState} from "@terreno/rtk";
import {type TypedUseSelectorHook, useSelector} from "react-redux";

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export type AppState = {
  darkMode: boolean;
  language: string;
};

const initialState: AppState = {
  darkMode: false,
  language: "en",
};

export const appStateSlice = createSlice({
  initialState,
  name: "appState",
  reducers: {
    resetAppState: () => initialState,
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.darkMode = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
  },
});

export const {setDarkMode, setLanguage, resetAppState} = appStateSlice.actions;

export const useSelectDarkMode = (): boolean => {
  return useAppSelector((state: RootState): boolean => {
    return state.appState.darkMode;
  });
};

export const useSelectLanguage = (): string => {
  return useAppSelector((state: RootState): string => {
    return state.appState.language;
  });
};

export default appStateSlice.reducer;
`;
};

const generateFrontendStoreErrors = (): string => {
  return `import type {Middleware} from "@reduxjs/toolkit";
import {useToast} from "@terreno/ui";

const ignoredErrors = [
  "Password or username is incorrect",
  "Token refresh failed with 401",
  "Failed to refresh token",
];

// biome-ignore lint/suspicious/noExplicitAny: Generic middleware
export const rtkQueryErrorMiddleware: Middleware = () => (next) => (action: any) => {
  if (action?.error && action?.payload) {
    const errorMessage =
      action.payload?.data?.title ??
      action.payload?.data?.message ??
      action.payload?.error ??
      JSON.stringify(action.payload);

    let endpointInfo = "unknown endpoint";
    if (action.meta?.baseQueryMeta?.request?.method && action.meta?.baseQueryMeta?.request?.url) {
      endpointInfo = \`\${action.meta.baseQueryMeta.request.url} \${action.meta.baseQueryMeta.request.method}\`;
    } else if (action.meta?.arg?.endpointName) {
      endpointInfo = \`\${action.meta.arg.endpointName} rejected \${action.meta.arg.type || ""}\`;
    }

    const message = \`\${endpointInfo.trim()}: \${errorMessage}\`;
    console.debug(message);

    if (action.payload.status === 404 || action.payload.status === 401) {
      return next(action);
    }

    const shouldIgnore = ignoredErrors.some((err) => errorMessage.includes(err));
    if (!shouldIgnore) {
      console.warn(message);
    }
  }

  return next(action);
};

export const useSentryAndToast = (): ((errorMessage: string) => void) => {
  const toast = useToast();
  return (error: string): void => {
    if (!error) {
      return;
    }
    toast.error(error);
    console.warn(\`Error: \${error}\`);
  };
};
`;
};

const generateFrontendStoreSdk = (): string => {
  return `import {generateTags} from "@terreno/rtk";
import startCase from "lodash/startCase";

import {addTagTypes, openapi} from "./openApiSdk";

export interface ProfileResponse {
  data: {
    _id: string;
    id: string;
    email: string;
    name: string;
  };
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  password?: string;
}

export const terrenoApi = openapi
  .injectEndpoints({
    endpoints: (builder) => ({
      getMe: builder.query<ProfileResponse, void>({
        providesTags: ["profile"],
        query: () => ({
          method: "GET",
          url: "/auth/me",
        }),
      }),
      patchMe: builder.mutation<ProfileResponse, UpdateProfileRequest>({
        invalidatesTags: ["profile"],
        query: (body) => ({
          body,
          method: "PATCH",
          url: "/auth/me",
        }),
      }),
    }),
  })
  .enhanceEndpoints({
    addTagTypes: ["profile"],
    endpoints: {
      ...generateTags(openapi, [...addTagTypes]),
    },
  });

export const {
  useEmailLoginMutation,
  useEmailSignUpMutation,
  useGetMeQuery,
  usePatchMeMutation,
} = terrenoApi;
export * from "./openApiSdk";

type OpenApiEndpoints = Record<string, unknown>;

export const getSdkHook = (
  modelName: string,
  type: "list" | "read" | "create" | "update" | "remove"
): Record<string, unknown> => {
  const modelPath = startCase(modelName).replace(/\\s/g, "");
  const endpoints = openapi.endpoints as OpenApiEndpoints;
  switch (type) {
    case "list":
      return endpoints[\`get\${modelPath}\`] as Record<string, unknown>;
    case "read":
      return endpoints[\`get\${modelPath}ById\`] as Record<string, unknown>;
    case "create":
      return endpoints[\`post\${modelPath}\`] as Record<string, unknown>;
    case "update":
      return endpoints[\`patch\${modelPath}ById\`] as Record<string, unknown>;
    case "remove":
      return endpoints[\`delete\${modelPath}ById\`] as Record<string, unknown>;
    default:
      throw new Error(\`Invalid SDK hook: \${modelName}/\${type}\`);
  }
};
`;
};

const generateFrontendStoreOpenApiSdk = (): string => {
  return `// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.
// Run "bun run sdk" to regenerate this file from the backend OpenAPI spec.

import {emptySplitApi as api} from "@terreno/rtk";
export const addTagTypes = ["Users", "Auth"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      emailLogin: build.mutation<EmailLoginRes, EmailLoginArgs>({
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: \`/auth/login\`,
        }),
      }),
      emailSignUp: build.mutation<EmailSignUpRes, EmailSignUpArgs>({
        query: (queryArg) => ({
          body: queryArg,
          method: "POST",
          url: \`/auth/signup\`,
        }),
      }),
    }),
    overrideExisting: false,
  });
export {injectedRtkApi as openapi};
export type EmailLoginArgs = {
  email: string;
  password: string;
};
export type EmailLoginRes = {
  token: string;
  refreshToken: string;
  userId: string;
};
export type EmailSignUpArgs = {
  email: string;
  password: string;
  name: string;
};
export type EmailSignUpRes = {
  token: string;
  refreshToken: string;
  userId: string;
};
export const {useEmailLoginMutation, useEmailSignUpMutation} = injectedRtkApi;
`;
};

const generateFrontendTheme = (): string => {
  return `// Theme configuration for the app
// Override these values to customize the app's appearance
// Colors are based on @terreno/ui's default theme primitives

export const primitives = {
  // Primary colors (teal/cyan)
  primary000: "#EBFAFF",
  primary050: "#BCE9F7",
  primary100: "#90D8F0",
  primary200: "#73CAE8",
  primary300: "#40B8E0",
  primary400: "#0E9DCD",
  primary500: "#0086B3",
  primary600: "#0A7092",
  primary700: "#035D7E",
  primary800: "#004B64",
  primary900: "#013749",

  // Secondary colors (dark teal)
  secondary000: "#F2F9FA",
  secondary050: "#D7E5EA",
  secondary100: "#B6CDD5",
  secondary200: "#9EB7BF",
  secondary300: "#87A1AA",
  secondary400: "#608997",
  secondary500: "#2B6072",
  secondary600: "#1C4E5F",
  secondary700: "#0F3D4D",
  secondary800: "#092E3A",
  secondary900: "#041E27",

  // Accent colors (gold/yellow)
  accent000: "#FFFDF7",
  accent050: "#FCECC2",
  accent100: "#F9E0A1",
  accent200: "#F7D582",
  accent300: "#F2CB62",
  accent400: "#E5B132",
  accent500: "#D69C0E",
  accent600: "#B58201",
  accent700: "#956A00",
  accent800: "#543C00",
  accent900: "#332400",

  // Neutral colors (grays)
  neutral000: "#FFFFFF",
  neutral050: "#F2F2F2",
  neutral100: "#E6E6E6",
  neutral200: "#D9D9D9",
  neutral300: "#CDCDCD",
  neutral400: "#B3B3B3",
  neutral500: "#9A9A9A",
  neutral600: "#686868",
  neutral700: "#4E4E4E",
  neutral800: "#353535",
  neutral900: "#1C1C1C",

  // Status colors
  error000: "#FDD7D7",
  error100: "#D33232",
  error200: "#BD1111",
  success000: "#DCF2E2",
  success100: "#3EA45C",
  success200: "#1A7F36",
  warning000: "#FFE3C6",
  warning100: "#F36719",
  warning200: "#B14202",
};

// Semantic color mappings - override these to change app appearance
export const colors = {
  // Backgrounds
  background: primitives.neutral000,
  backgroundSecondary: primitives.neutral050,

  // Text
  text: primitives.neutral900,
  textSecondary: primitives.neutral600,
  textInverted: primitives.neutral000,

  // Primary action colors
  primary: primitives.primary400,
  primaryDark: primitives.primary600,
  primaryLight: primitives.primary100,

  // Secondary colors
  secondary: primitives.secondary500,
  secondaryDark: primitives.secondary700,
  secondaryLight: primitives.secondary100,

  // Accent colors
  accent: primitives.accent500,
  accentDark: primitives.accent700,
  accentLight: primitives.accent100,

  // Status colors
  error: primitives.error100,
  errorLight: primitives.error000,
  success: primitives.success100,
  successLight: primitives.success000,
  warning: primitives.warning100,
  warningLight: primitives.warning000,

  // UI elements
  border: primitives.neutral300,
  borderFocus: primitives.primary200,
  icon: primitives.neutral600,
  tint: primitives.primary400,

  // Tab bar
  tabIconDefault: primitives.neutral600,
  tabIconSelected: primitives.primary400,
};

export default colors;
`;
};

const generateFrontendEnv = (): string => {
  return `EXPO_PUBLIC_API_URL=http://localhost:4000
`;
};

const generateFrontendUtilsIndex = (): string => {
  return `export const captureException = (error: unknown): void => {
  console.error("Captured exception:", error);
};

export const captureMessage = (message: string): void => {
  console.warn("Captured message:", message);
};

export const createSentryReduxEnhancer = (): unknown => {
  return undefined;
};
`;
};

const generateBackendCiWorkflow = (_args: BootstrapArgs): string => {
  return `name: Backend CI

on:
  push:
    paths:
      - "backend/**"
      - ".github/workflows/backend-ci.yml"

jobs:
  lint-and-test:
    name: Backend Lint, Build, and Test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        mongodb-version: ["6.0"]
    steps:
      - uses: actions/checkout@v6

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Cache Bun dependencies
        id: cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.bun/install/cache
            node_modules
          key: bun-\${{ runner.os }}-\${{ github.ref }}-\${{ hashFiles('bun.lockb', 'package.json') }}
          restore-keys: |
            bun-\${{ runner.os }}-\${{ github.ref }}-
            bun-\${{ runner.os }}-

      - name: Start MongoDB
        uses: supercharge/mongodb-github-action@1.12.1
        with:
          mongodb-version: \${{ matrix.mongodb-version }}

      - name: Install dependencies
        run: bun install --frozen-lockfile
        working-directory: backend

      - name: Lint
        run: bun run lint
        working-directory: backend

      - name: Build
        run: bun run compile
        working-directory: backend

      - name: Test
        run: bun run test
        working-directory: backend
        env:
          CI: true
`;
};

const generateRulesyncConfig = (): string => {
  return JSON.stringify(
    {
      $schema:
        "https://raw.githubusercontent.com/dyoshikawa/rulesync/refs/heads/main/config-schema.json",
      baseDirs: ["."],
      delete: true,
      features: ["rules"],
      targets: ["cursor", "windsurf", "claudecode", "copilot"],
      verbose: false,
    },
    null,
    2
  );
};

const generateRootRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName, description} = args;
  const appDescription =
    description || `A full-stack application built with the Terreno framework.`;

  return `---
root: true
targets: ["cursor", "windsurf", "copilot"]
description: "${appDisplayName} root guidelines"
globs: ["**/*"]
---

# ${appDisplayName}

${appDescription}

## Project Structure

- **frontend/** - Expo/React Native frontend using @terreno/ui and @terreno/rtk
- **backend/** - Express/Mongoose backend using @terreno/api

## Development

Uses [Bun](https://bun.sh/) as the package manager.

\`\`\`bash
# Backend
cd backend && bun run dev    # Start backend on port 4000

# Frontend
cd frontend && bun run web   # Start web frontend
cd frontend && bun run sdk   # Regenerate SDK after backend changes
\`\`\`

## Code Style

### TypeScript/JavaScript
- Use ES module syntax and TypeScript for all code
- Prefer interfaces over types; avoid enums, use maps
- Prefer const arrow functions over \`function\` keyword
- Use descriptive variable names with auxiliary verbs (e.g., \`isLoading\`)
- Use camelCase directories (e.g., \`components/authWizard\`)
- Favor named exports
- Use the RORO pattern (Receive an Object, Return an Object)

### Dates and Time
- Always use Luxon instead of Date or dayjs

### Error Handling
- Check error conditions at start of functions and return early
- Limit nested if statements
- Use multiline syntax with curly braces for all conditionals

### Testing
- Use bun test with expect for testing

### Logging
- Frontend: Use \`console.info\`, \`console.debug\`, \`console.warn\`, or \`console.error\` for permanent logs
- Backend: Use \`logger.info/warn/error/debug\` for permanent logs
- Use \`console.log\` only for debugging (to be removed)

### Development Practices
- Don't apologize for errors: fix them
- Prioritize modularity, DRY, performance, and security
- Focus on readability over performance
- Write complete, functional code without TODOs when possible
- Comments should describe purpose, not effect

## Package Reference

### @terreno/api

REST API framework providing:

- **modelRouter**: Auto-generates CRUD endpoints for Mongoose models
- **Permissions**: \`IsAuthenticated\`, \`IsOwner\`, \`IsAdmin\`, \`IsAuthenticatedOrReadOnly\`
- **Query Filters**: \`OwnerQueryFilter\` for filtering list queries by owner
- **setupServer**: Express server setup with auth, OpenAPI, and middleware
- **APIError**: Standardized error handling
- **logger**: Winston-based logging

Key imports:
\`\`\`typescript
import {
  modelRouter,
  setupServer,
  Permissions,
  OwnerQueryFilter,
  APIError,
  logger,
  asyncHandler,
  authenticateMiddleware,
} from "@terreno/api";
\`\`\`

#### modelRouter Usage

\`\`\`typescript
import {modelRouter, modelRouterOptions, Permissions} from "@terreno/api";

const router = modelRouter(YourModel, {
  permissions: {
    list: [Permissions.IsAuthenticated],
    create: [Permissions.IsAuthenticated],
    read: [Permissions.IsOwner],
    update: [Permissions.IsOwner],
    delete: [],  // Disabled
  },
  sort: "-created",
  queryFields: ["_id", "type", "name"],
});
\`\`\`

#### Custom Routes

For non-CRUD endpoints, use the OpenAPI builder:

\`\`\`typescript
import {asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";

router.get("/yourRoute/:id", [
  authenticateMiddleware(),
  createOpenApiBuilder(options)
    .withTags(["yourTag"])
    .withSummary("Brief summary")
    .withPathParameter("id", {type: "string"})
    .withResponse(200, {data: {type: "object"}})
    .build(),
], asyncHandler(async (req, res) => {
  return res.json({data: result});
}));
\`\`\`

#### API Conventions

- Throw \`APIError\` with appropriate status codes: \`throw new APIError({status: 400, title: "Message"})\`
- Do not use \`Model.findOne\` - use \`Model.findExactlyOne\` or \`Model.findOneOrThrow\`
- Define statics/methods by direct assignment: \`schema.methods = {bar() {}}\`
- All model types live in \`src/types/models/\`
- In routes: \`req.user\` is \`UserDocument | undefined\`

### @terreno/ui

React Native component library with 88+ components:

- **Layout**: Box, Page, SplitPage, Card
- **Forms**: TextField, SelectField, DateTimeField, CheckBox
- **Display**: Text, Heading, Badge, DataTable
- **Actions**: Button, IconButton, Link
- **Feedback**: Spinner, Modal, Toast
- **Theming**: TerrenoProvider, useTheme

Key imports:
\`\`\`typescript
import {
  Box,
  Button,
  Card,
  Page,
  Text,
  TextField,
  TerrenoProvider,
} from "@terreno/ui";
\`\`\`

#### UI Component Examples

Layout with Box:
\`\`\`typescript
<Box direction="row" padding={4} gap={2} alignItems="center">
  <Text>Content</Text>
  <Button text="Action" />
</Box>
\`\`\`

Buttons:
\`\`\`typescript
<Button
  text="Submit"
  variant="primary"  // 'primary' | 'secondary' | 'outline' | 'ghost'
  onClick={handleSubmit}
  loading={isLoading}
  iconName="check"
/>
\`\`\`

Forms:
\`\`\`typescript
<TextField
  label="Email"
  value={email}
  onChangeText={setEmail}
  error={emailError}
  helperText="Enter a valid email"
/>
\`\`\`

#### UI Common Pitfalls

- Don't use inline styles when theme values are available
- Don't use raw \`View\`/\`Text\` when \`Box\`/@terreno/ui \`Text\` are available
- Don't forget loading and error states
- Don't use \`style\` prop when equivalent props exist (\`padding\`, \`margin\`)
- Never modify \`openApiSdk.ts\` manually

### @terreno/rtk

Redux Toolkit Query integration:

- **generateAuthSlice**: Creates auth reducer and middleware with JWT handling
- **emptyApi**: Base RTK Query API for code generation
- **Platform utilities**: Secure token storage

Key imports:
\`\`\`typescript
import {generateAuthSlice} from "@terreno/rtk";
\`\`\`

Always use generated SDK hooks - never use \`axios\` or \`request\` directly:

\`\`\`typescript
// Correct
import {useGetYourRouteQuery} from "@/store/openApiSdk";
const {data, isLoading, error} = useGetYourRouteQuery({id: "value"});

// Wrong - don't use axios directly
// const result = await axios.get("/api/yourRoute/value");
\`\`\`

## React Best Practices

- Use functional components with \`React.FC\` type
- Import hooks directly: \`import {useEffect, useMemo} from 'react'\`
- Always provide return types for functions
- Add explanatory comment above each \`useEffect\`
- Wrap callbacks in \`useCallback\`
- Prefer const arrow functions
- Use inline styles over \`StyleSheet.create\`
- Use Luxon for date operations
- Place static content and interfaces at beginning of file
- Minimize \`use client\`, \`useEffect\`, and \`setState\`
- Always support React-Native Web
`;
};

const generateClaudeCodeRootRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName, description} = args;
  const appDescription =
    description || `A full-stack application built with the Terreno framework.`;

  return `---
localRoot: true
targets: ["claudecode"]
description: "${appDisplayName} Claude Code guidelines"
globs: ["**/*"]
---

# ${appDisplayName}

${appDescription}

## Project Structure

- **frontend/** - Expo/React Native frontend using @terreno/ui and @terreno/rtk
- **backend/** - Express/Mongoose backend using @terreno/api

## Development

Uses [Bun](https://bun.sh/) as the package manager.

\`\`\`bash
# Backend
cd backend && bun run dev    # Start backend on port 4000

# Frontend
cd frontend && bun run web   # Start web frontend
cd frontend && bun run sdk   # Regenerate SDK after backend changes
\`\`\`

## Code Style

### TypeScript/JavaScript
- Use ES module syntax and TypeScript for all code
- Prefer interfaces over types; avoid enums, use maps
- Prefer const arrow functions over \`function\` keyword
- Use descriptive variable names with auxiliary verbs (e.g., \`isLoading\`)
- Use camelCase directories (e.g., \`components/authWizard\`)
- Favor named exports
- Use the RORO pattern (Receive an Object, Return an Object)

### Dates and Time
- Always use Luxon instead of Date or dayjs

### Error Handling
- Check error conditions at start of functions and return early
- Limit nested if statements
- Use multiline syntax with curly braces for all conditionals

### Testing
- Use bun test with expect for testing

### Logging
- Frontend: Use \`console.info\`, \`console.debug\`, \`console.warn\`, or \`console.error\` for permanent logs
- Backend: Use \`logger.info/warn/error/debug\` for permanent logs
- Use \`console.log\` only for debugging (to be removed)

### Development Practices
- Don't apologize for errors: fix them
- Prioritize modularity, DRY, performance, and security
- Focus on readability over performance
- Write complete, functional code without TODOs when possible
- Comments should describe purpose, not effect

## Package Reference

### @terreno/api

REST API framework providing:

- **modelRouter**: Auto-generates CRUD endpoints for Mongoose models
- **Permissions**: \`IsAuthenticated\`, \`IsOwner\`, \`IsAdmin\`, \`IsAuthenticatedOrReadOnly\`
- **setupServer**: Express server setup with auth, OpenAPI, and middleware
- **APIError**: Standardized error handling
- **logger**: Winston-based logging

Key imports:
\`\`\`typescript
import {
  modelRouter,
  setupServer,
  Permissions,
  OwnerQueryFilter,
  APIError,
  logger,
  asyncHandler,
  authenticateMiddleware,
} from "@terreno/api";
\`\`\`

### @terreno/ui

React Native component library with 88+ components:

- **Layout**: Box, Page, SplitPage, Card
- **Forms**: TextField, SelectField, DateTimeField, CheckBox
- **Display**: Text, Heading, Badge, DataTable
- **Actions**: Button, IconButton, Link
- **Feedback**: Spinner, Modal, Toast
- **Theming**: TerrenoProvider, useTheme

Key imports:
\`\`\`typescript
import {
  Box,
  Button,
  Card,
  Page,
  Text,
  TextField,
  TerrenoProvider,
} from "@terreno/ui";
\`\`\`

### @terreno/rtk

Redux Toolkit Query integration:

- **generateAuthSlice**: Creates auth reducer and middleware with JWT handling
- **emptyApi**: Base RTK Query API for code generation
- **Platform utilities**: Secure token storage

Key imports:
\`\`\`typescript
import {generateAuthSlice} from "@terreno/rtk";
\`\`\`
`;
};

const generateBackendRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `---
root: true
targets: ["cursor", "windsurf", "copilot"]
description: "${appDisplayName} backend guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Backend

Express/Mongoose backend using @terreno/api.

## Development

\`\`\`bash
bun run dev      # Start on port 4000
bun run test     # Run tests
bun run lint     # Lint code
\`\`\`

## Backend Conventions

- Use \`modelRouter\` for CRUD endpoints
- Use \`APIError\` for error responses: \`throw new APIError({status: 400, title: "Message"})\`
- Use \`logger.info/warn/error/debug\` for logging
- Use \`Model.findExactlyOne\` or \`Model.findOneOrNone\` (not \`Model.findOne\`)
- All model types live in \`src/types/models/\`
- In routes: \`req.user\` is \`UserDocument | undefined\`

## Adding a New Model

1. Create model in \`src/models/yourModel.ts\`
2. Create types in \`src/types/models/yourModelTypes.ts\`
3. Export from \`src/models/index.ts\` and \`src/types/models/index.ts\`
4. Create route in \`src/api/yourModel.ts\`
5. Register route in \`src/server.ts\`
`;
};

const _generateBackendClaudeRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `---
localRoot: true
targets: ["claudecode"]
description: "${appDisplayName} backend Claude Code guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Backend

Express/Mongoose backend using @terreno/api.

## Development

\`\`\`bash
bun run dev      # Start on port 4000
bun run test     # Run tests
bun run lint     # Lint code
\`\`\`

## Backend Conventions

- Use \`modelRouter\` for CRUD endpoints
- Use \`APIError\` for error responses: \`throw new APIError({status: 400, title: "Message"})\`
- Use \`logger.info/warn/error/debug\` for logging
- Use \`Model.findExactlyOne\` or \`Model.findOneOrNone\` (not \`Model.findOne\`)
- All model types live in \`src/types/models/\`
- In routes: \`req.user\` is \`UserDocument | undefined\`

## Adding a New Model

1. Create model in \`src/models/yourModel.ts\`
2. Create types in \`src/types/models/yourModelTypes.ts\`
3. Export from \`src/models/index.ts\` and \`src/types/models/index.ts\`
4. Create route in \`src/api/yourModel.ts\`
5. Register route in \`src/server.ts\`
`;
};

const generateFrontendRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `---
root: true
targets: ["cursor", "windsurf", "copilot"]
description: "${appDisplayName} frontend guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Frontend

Expo/React Native frontend using @terreno/ui and @terreno/rtk.

## Development

\`\`\`bash
bun run web      # Start web frontend on port 8082
bun run sdk      # Regenerate SDK from backend OpenAPI spec
bun run lint     # Lint code
\`\`\`

## Frontend Conventions

- Use generated SDK hooks from \`@/store/openApiSdk\`
- Use @terreno/ui components (Box, Page, Button, TextField, etc.)
- Never modify \`openApiSdk.ts\` manually - regenerate with \`bun run sdk\`
- Use Luxon for date operations
- Use Redux Toolkit for state management

## Adding a New Screen

1. Regenerate SDK if backend changed: \`bun run sdk\`
2. Create screen in \`app/\` directory
3. Use @terreno/ui components for layout
4. Use SDK hooks for data fetching
`;
};

const _generateFrontendClaudeRulesFile = (args: BootstrapArgs): string => {
  const {appDisplayName} = args;
  return `---
localRoot: true
targets: ["claudecode"]
description: "${appDisplayName} frontend Claude Code guidelines"
globs: ["**/*"]
---

# ${appDisplayName} Frontend

Expo/React Native frontend using @terreno/ui and @terreno/rtk.

## Development

\`\`\`bash
bun run web      # Start web frontend on port 8082
bun run sdk      # Regenerate SDK from backend OpenAPI spec
bun run lint     # Lint code
\`\`\`

## Frontend Conventions

- Use generated SDK hooks from \`@/store/openApiSdk\`
- Use @terreno/ui components (Box, Page, Button, TextField, etc.)
- Never modify \`openApiSdk.ts\` manually - regenerate with \`bun run sdk\`
- Use Luxon for date operations
- Use Redux Toolkit for state management

## Adding a New Screen

1. Regenerate SDK if backend changed: \`bun run sdk\`
2. Create screen in \`app/\` directory
3. Use @terreno/ui components for layout
4. Use SDK hooks for data fetching
`;
};

interface AiRulesFile {
  path: string;
  content: string;
}

const generateAiRulesFiles = (args: BootstrapArgs): AiRulesFile[] => {
  // Strip frontmatter for direct output files
  const stripFrontmatter = (content: string): string => {
    return content.replace(/^---[\s\S]*?---\n\n?/, "");
  };

  const backendContent = stripFrontmatter(generateBackendRulesFile(args));
  const frontendContent = stripFrontmatter(generateFrontendRulesFile(args));

  return [
    // .rulesync/rules/ source files (these are the source of truth for root)
    {content: generateRootRulesFile(args), path: ".rulesync/rules/00-root.md"},
    {content: generateClaudeCodeRootRulesFile(args), path: ".rulesync/rules/01-claudecode-root.md"},

    // Direct output files for backend (AGENTS.md and CLAUDE.md in backend/)
    {content: backendContent, path: "backend/AGENTS.md"},
    {content: backendContent, path: "backend/CLAUDE.md"},

    // Direct output files for frontend (AGENTS.md and CLAUDE.md in frontend/)
    {content: frontendContent, path: "frontend/AGENTS.md"},
    {content: frontendContent, path: "frontend/CLAUDE.md"},

    // Rulesync config (only syncs root level files)
    {content: generateRulesyncConfig(), path: "rulesync.jsonc"},
  ];
};

export const handleBootstrapAiRulesToolCall = (
  args: Record<string, unknown>
): {content: Array<{type: "text"; text: string}>} => {
  const bootstrapArgs = args as unknown as BootstrapArgs;

  if (!bootstrapArgs.appName || !bootstrapArgs.appDisplayName) {
    return {
      content: [
        {
          text: "Error: appName and appDisplayName are required parameters",
          type: "text",
        },
      ],
    };
  }

  const files = generateAiRulesFiles(bootstrapArgs);

  const fileList = files.map((f) => `- \`${f.path}\``).join("\n");

  const instructions = `# Bootstrap AI Rules for ${bootstrapArgs.appDisplayName}

## Files to Create

The following AI coding assistant configuration files need to be created:

${fileList}

## Instructions

1. **Create all the files listed above.** Each file's content is provided below.

2. **Install rulesync** (required for syncing root-level rules to all AI tools):
   \`\`\`bash
   npm install -g rulesync
   \`\`\`

3. **Run rulesync to generate root-level AI tool configs:**
   \`\`\`bash
   rulesync sync
   \`\`\`
   
   This generates root-level files from \`.rulesync/rules/\`:
   - \`.cursorrules\`, \`.windsurfrules\`, \`.github/copilot-instructions.md\`, \`.claude/CLAUDE.local.md\`, \`AGENTS.md\`

## How It Works

- **\`.rulesync/rules/\`** - Source of truth for root-level AI coding guidelines
- **\`rulesync.jsonc\`** - Configuration for rulesync tool (root only)
- **\`backend/AGENTS.md\` & \`backend/CLAUDE.md\`** - Direct context files for backend
- **\`frontend/AGENTS.md\` & \`frontend/CLAUDE.md\`** - Direct context files for frontend

## Keeping Rules Updated

- **Root rules**: Edit \`.rulesync/rules/\` and run \`rulesync sync\`
- **Backend/Frontend rules**: Edit \`backend/AGENTS.md\` or \`frontend/AGENTS.md\` directly (and copy to CLAUDE.md)

---

## File Contents

`;

  const fileContents = files
    .map((f) => {
      const lang = f.path.endsWith(".json") || f.path.endsWith(".jsonc") ? "json" : "markdown";
      return `### \`${f.path}\`

\`\`\`${lang}
${f.content}
\`\`\`
`;
    })
    .join("\n");

  return {
    content: [{text: instructions + fileContents, type: "text"}],
  };
};

const generateFrontendCiWorkflow = (_args: BootstrapArgs): string => {
  return `name: Frontend CI

on:
  push:
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"

jobs:
  lint-and-test:
    name: Frontend Lint, Build, and Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Cache Bun dependencies
        id: cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.bun/install/cache
            node_modules
          key: bun-\${{ runner.os }}-\${{ github.ref }}-\${{ hashFiles('bun.lockb', 'package.json') }}
          restore-keys: |
            bun-\${{ runner.os }}-\${{ github.ref }}-
            bun-\${{ runner.os }}-

      - name: Install dependencies
        run: bun install --frozen-lockfile
        working-directory: frontend

      - name: Lint
        run: bun run lint
        working-directory: frontend

      - name: TypeScript compile
        run: bun run compile
        working-directory: frontend

      - name: Test
        run: bun run test
        working-directory: frontend
        env:
          CI: true
`;
};

interface GeneratedFile {
  path: string;
  content: string;
}

const generateAllFiles = (args: BootstrapArgs): GeneratedFile[] => {
  const frontendDir = `frontend`;
  const backendDir = `backend`;

  return [
    // Root files
    {content: generateCursorRules(args), path: ".cursorrules"},
    {content: generateMcpSettings(args), path: ".cursor/mcp.json"},
    {content: generateClaudeMd(args), path: "CLAUDE.md"},

    // Backend files
    {content: generateBackendPackageJson(args), path: `${backendDir}/package.json`},
    {content: generateBackendTsConfig(), path: `${backendDir}/tsconfig.json`},
    {content: generateBackendBiomeJsonc(), path: `${backendDir}/biome.jsonc`},
    {content: generateBackendIndex(), path: `${backendDir}/src/index.ts`},
    {content: generateBackendServer(args), path: `${backendDir}/src/server.ts`},
    {content: generateBackendDatabase(args), path: `${backendDir}/src/utils/database.ts`},
    {content: generateBackendModelPlugins(), path: `${backendDir}/src/models/modelPlugins.ts`},
    {content: generateBackendUserModel(), path: `${backendDir}/src/models/user.ts`},
    {content: generateBackendModelsIndex(), path: `${backendDir}/src/models/index.ts`},
    {content: generateBackendUserRoutes(), path: `${backendDir}/src/api/users.ts`},
    {content: generateBackendTypes(), path: `${backendDir}/src/types/index.ts`},
    {content: generateBackendTypesModels(), path: `${backendDir}/src/types/models/index.ts`},
    {content: generateBackendUserTypes(), path: `${backendDir}/src/types/models/userTypes.ts`},

    // Frontend files
    {content: generateFrontendPackageJson(args), path: `${frontendDir}/package.json`},
    {content: generateFrontendAppJson(args), path: `${frontendDir}/app.json`},
    {content: generateFrontendTsConfig(), path: `${frontendDir}/tsconfig.json`},
    {content: generateFrontendTsConfigCodegen(), path: `${frontendDir}/tsconfig.codegen.json`},
    {content: generateFrontendBiomeJsonc(), path: `${frontendDir}/biome.jsonc`},
    {content: generateFrontendOpenApiConfig(), path: `${frontendDir}/openapi-config.ts`},
    {content: generateFrontendGenerateSdk(), path: `${frontendDir}/scripts/generate-sdk.ts`},
    {content: generateFrontendRootLayout(args), path: `${frontendDir}/app/_layout.tsx`},
    {content: generateFrontendLogin(), path: `${frontendDir}/app/login.tsx`},
    {content: generateFrontendNotFound(), path: `${frontendDir}/app/+not-found.tsx`},
    {content: generateFrontendTabsLayout(), path: `${frontendDir}/app/(tabs)/_layout.tsx`},
    {content: generateFrontendTabsIndex(args), path: `${frontendDir}/app/(tabs)/index.tsx`},
    {content: generateFrontendTabsProfile(), path: `${frontendDir}/app/(tabs)/profile.tsx`},
    {content: generateFrontendStoreIndex(), path: `${frontendDir}/store/index.ts`},
    {content: generateFrontendStoreAppState(), path: `${frontendDir}/store/appState.ts`},
    {content: generateFrontendStoreErrors(), path: `${frontendDir}/store/errors.ts`},
    {content: generateFrontendStoreSdk(), path: `${frontendDir}/store/sdk.ts`},
    {content: generateFrontendStoreOpenApiSdk(), path: `${frontendDir}/store/openApiSdk.ts`},
    {content: generateFrontendTheme(), path: `${frontendDir}/constants/theme.ts`},
    {content: generateFrontendUtilsIndex(), path: `${frontendDir}/utils/index.ts`},
    {content: generateFrontendEnv(), path: `${frontendDir}/.env`},

    // GitHub Actions workflows
    {content: generateBackendCiWorkflow(args), path: ".github/workflows/backend-ci.yml"},
    {content: generateFrontendCiWorkflow(args), path: ".github/workflows/frontend-ci.yml"},
  ];
};

export const handleBootstrapToolCall = (
  name: string,
  args: Record<string, unknown>
): {content: Array<{type: "text"; text: string}>} => {
  if (name === "bootstrap_ai_rules") {
    return handleBootstrapAiRulesToolCall(args);
  }

  if (name !== "bootstrap_app") {
    return {
      content: [{text: `Unknown bootstrap tool: ${name}`, type: "text"}],
    };
  }

  const bootstrapArgs = args as unknown as BootstrapArgs;

  if (!bootstrapArgs.appName || !bootstrapArgs.appDisplayName) {
    return {
      content: [
        {
          text: "Error: appName and appDisplayName are required parameters",
          type: "text",
        },
      ],
    };
  }

  const files = generateAllFiles(bootstrapArgs);

  const fileList = files.map((f) => `- \`${f.path}\``).join("\n");

  const instructions = `# Bootstrap ${bootstrapArgs.appDisplayName}

## Files to Create

The following files need to be created for your new Terreno application:

${fileList}

## Instructions

1. **Create the project directory:**
   \`\`\`bash
   mkdir ${bootstrapArgs.appName}
   cd ${bootstrapArgs.appName}
   \`\`\`

2. **Create all the files listed above.** Each file's content is provided below.

3. **Create asset directories and download assets from Expo:**
   \`\`\`bash
   mkdir -p frontend/assets/fonts
   mkdir -p frontend/assets/images

   # Download SpaceMono font
   curl -L -o frontend/assets/fonts/SpaceMono-Regular.ttf \\
     "https://github.com/expo/expo/raw/main/templates/expo-template-blank-typescript/assets/fonts/SpaceMono-Regular.ttf"

   # Download Expo default images
   curl -L -o frontend/assets/images/icon.png \\
     "https://github.com/expo/expo/raw/main/templates/expo-template-blank-typescript/assets/images/icon.png"
   curl -L -o frontend/assets/images/splash-icon.png \\
     "https://github.com/expo/expo/raw/main/templates/expo-template-blank-typescript/assets/images/splash-icon.png"
   curl -L -o frontend/assets/images/adaptive-icon.png \\
     "https://github.com/expo/expo/raw/main/templates/expo-template-blank-typescript/assets/images/adaptive-icon.png"
   curl -L -o frontend/assets/images/favicon.png \\
     "https://github.com/expo/expo/raw/main/templates/expo-template-blank-typescript/assets/images/favicon.png"
   \`\`\`

4. **Install dependencies:**
   \`\`\`bash
   cd backend && bun install
   cd ../frontend && bun install
   \`\`\`

5. **Start MongoDB** (required for backend):
   \`\`\`bash
   # Using Docker:
   docker run -d -p 27017:27017 mongo:latest

   # Or install MongoDB locally
   \`\`\`

6. **Start the backend:**
   \`\`\`bash
   cd backend && bun run dev
   \`\`\`

7. **In a new terminal, regenerate and start the frontend:**
   \`\`\`bash
   cd frontend
   bun run sdk  # Generate SDK from backend
   bun run web  # Start web frontend
   \`\`\`

8. **Open http://localhost:8082** in your browser

## MCP Integration

The project is configured to use the Terreno MCP server at:
\`${bootstrapArgs.mcpServerUrl || "https://mcp.terreno.flourish.health"}\`

This provides AI assistance with:
- Generating models and routes
- Creating screens and forms
- Following Terreno patterns

---

## File Contents

`;

  const fileContents = files
    .map((f) => {
      const lang = f.path.endsWith(".json") ? "json" : "typescript";
      return `### \`${f.path}\`

\`\`\`${lang}
${f.content}
\`\`\`
`;
    })
    .join("\n");

  return {
    content: [{text: instructions + fileContents, type: "text"}],
  };
};

// Prompt for bootstrapping
interface BootstrapPrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export const bootstrapPrompts: BootstrapPrompt[] = [
  {
    arguments: [
      {
        description: "Application name in kebab-case (e.g., 'my-app', 'todo-manager')",
        name: "appName",
        required: true,
      },
      {
        description: "Human-readable display name (e.g., 'My App', 'Todo Manager')",
        name: "appDisplayName",
        required: true,
      },
    ],
    description:
      "Bootstrap a new Terreno full-stack application with frontend, backend, Cursor rules, and MCP integration",
    name: "bootstrap_terreno_app",
  },
];

export const handleBootstrapPromptRequest = (
  name: string,
  args: Record<string, string>
): {messages: Array<{role: "user"; content: {type: "text"; text: string}}>} => {
  if (name !== "bootstrap_terreno_app") {
    return {
      messages: [
        {
          content: {
            text: `Unknown bootstrap prompt: ${name}`,
            type: "text",
          },
          role: "user",
        },
      ],
    };
  }

  const {appName, appDisplayName} = args;

  const prompt = `Please bootstrap a new Terreno application with the following details:

- **App Name** (kebab-case): ${appName}
- **Display Name**: ${appDisplayName}

Use the \`bootstrap_app\` tool to generate all the necessary files for the application.

After generating the files:
1. Create all directories and files as specified
2. Download assets from Expo's GitHub using the provided curl commands
3. Install dependencies with \`bun install\`
4. Start MongoDB
5. Start the backend with \`bun run dev\`
6. Generate the SDK with \`bun run sdk\` in the frontend
7. Start the frontend with \`bun run web\`

The application should include:
- Full authentication flow (login/signup)
- Tab-based navigation with Home and Profile screens
- Redux state management with persistence
- RTK Query SDK generation from OpenAPI spec
- Cursor rules for AI assistance
- MCP integration for development assistance

**IMPORTANT: After completing the bootstrap_app steps, also run the \`bootstrap_ai_rules\` tool** with the same appName and appDisplayName to set up AI coding assistant rules for Cursor, Windsurf, Claude Code, and GitHub Copilot. This will create:
- AGENTS.md files for each directory
- .cursorrules and .windsurfrules files
- GitHub Copilot instructions
- Claude Code local rules
- rulesync.jsonc for keeping rules in sync

Then install rulesync to keep AI rules synchronized:
\`\`\`bash
npm install -g rulesync
\`\`\``;

  return {
    messages: [
      {
        content: {
          text: prompt,
          type: "text",
        },
        role: "user",
      },
    ],
  };
};
