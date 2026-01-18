interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  content: string;
}

export const resources: Resource[] = [
  {
    content: `# Terreno Overview

A monorepo containing shared packages for building full-stack applications with React Native and Express/Mongoose.

## Packages

- **@terreno/api** - REST API framework built on Express/Mongoose
- **@terreno/ui** - React Native UI component library
- **@terreno/rtk** - Redux Toolkit Query utilities for API backends

## Development

Uses [Bun](https://bun.sh/) as the package manager. Use \`bun\` commands, not \`npm\`.

\`\`\`bash
bun install              # Install dependencies
bun run compile          # Compile all packages
bun run lint             # Lint all packages
bun run lint:fix         # Fix lint issues
bun run test             # Run tests in api and ui
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
`,
    description: "Overview of the Terreno monorepo and its packages",
    mimeType: "text/markdown",
    name: "Terreno Overview",
    uri: "terreno://docs/overview",
  },
  {
    content: `# @terreno/api Documentation

Django REST Framework-styled batteries-included framework for building REST APIs with Node/Express/Mongoose.

## Key Exports

- \`modelRouter\` - Auto-creates CRUD APIs for Mongoose models
- \`Permissions\` - Declarative permission system
- \`APIError\` - Standardized error handling (JSON:API format)
- \`authenticateMiddleware\` - JWT/Passport authentication
- \`createOpenApiBuilder\` - Fluent API for custom route documentation

## modelRouter

The core of @terreno/api. Auto-generates CRUD endpoints for Mongoose models.

\`\`\`typescript
import { modelRouter, Permissions, OwnerQueryFilter } from "@terreno/api";

export const addTodoRoutes = (router: Router) => {
  router.use("/todos", modelRouter(Todo, {
    permissions: {
      create: [Permissions.IsAuthenticated],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsOwner],
      update: [Permissions.IsOwner],
      delete: [Permissions.IsOwner],
    },
    queryFields: ["completed", "ownerId"],
    queryFilter: OwnerQueryFilter,
    sort: "-created",
    preCreate: (body, req) => ({
      ...body,
      ownerId: (req.user as UserDocument)?._id,
    }),
  }));
};
\`\`\`

### Configuration Options

| Option | Description |
|--------|-------------|
| \`permissions\` | Object with create/list/read/update/delete permissions |
| \`queryFields\` | Fields allowed in query string filters |
| \`sort\` | Default sort order (prefix with - for descending) |
| \`populatePaths\` | Relations to populate in responses |
| \`preCreate/preUpdate/preDelete\` | Hooks run before operations |
| \`postCreate/postUpdate/postDelete\` | Hooks run after operations |
| \`responseHandler\` | Final serialization before returning to client |
| \`transformer\` | Data transformation rules |
| \`queryFilter\` | Filter applied to all queries (e.g., OwnerQueryFilter) |

## Permissions System

\`\`\`typescript
import { Permissions } from "@terreno/api";

// Built-in permissions
Permissions.IsAny              // Allow any user (including anonymous)
Permissions.IsAuthenticated    // Require logged-in user
Permissions.IsAdmin            // Require admin user
Permissions.IsOwner            // Require user to own the resource
Permissions.IsAuthenticatedOrReadOnly  // Auth for writes, public reads

// Custom permission
const IsVerified = (method, user, obj) => user?.isVerified === true;
\`\`\`

## APIError

\`\`\`typescript
import { APIError } from "@terreno/api";

// Throw standardized errors
throw new APIError({
  status: 400,
  title: "Validation Error",
  detail: "Email is required",
  code: "VALIDATION_ERROR",
  fields: { email: "Email is required" },
});
\`\`\`

## Lifecycle Hooks

\`\`\`typescript
modelRouter(Model, {
  // Before operations
  preCreate: (body, req) => ({ ...body, ownerId: req.user._id }),
  preUpdate: (body, req, existingDoc) => body,
  preDelete: (req, existingDoc) => { /* validation */ },

  // After operations
  postCreate: (doc, req) => { /* send notification */ },
  postUpdate: (doc, req) => { /* audit log */ },
  postDelete: (doc, req) => { /* cleanup */ },

  // Response handling
  responseHandler: (doc, req) => transformDoc(doc),
});
\`\`\`

## Transformers

\`\`\`typescript
import { AdminOwnerTransformer } from "@terreno/api";

modelRouter(Model, {
  transformer: new AdminOwnerTransformer({
    adminFields: ["internalNotes", "revenue"],
    ownerFields: ["email", "settings"],
    publicFields: ["name", "avatar"],
  }),
});
\`\`\`

## Mongoose Plugins

\`\`\`typescript
import {
  createdUpdatedPlugin,
  isDeletedPlugin,
  isDisabledPlugin,
  baseUserPlugin,
  addDefaultPlugins
} from "@terreno/api";

// Individual plugins
schema.plugin(createdUpdatedPlugin);  // Adds created/updated timestamps
schema.plugin(isDeletedPlugin);       // Soft delete support
schema.plugin(isDisabledPlugin);      // Account disable support

// Or add all default plugins
addDefaultPlugins(schema);
\`\`\`

## OpenAPI Builder

\`\`\`typescript
import { createOpenApiBuilder } from "@terreno/api";

const builder = createOpenApiBuilder()
  .withTags(["Users"])
  .withSummary("Get user profile")
  .withQueryParameter("include", "string", false, "Fields to include")
  .withResponse(200, UserSchema);

router.get("/profile", builder.build(), async (req, res) => {
  // handler
});
\`\`\`

## Authentication

\`\`\`typescript
import { authenticateMiddleware, signupUser, generateTokens } from "@terreno/api";

// Protect routes
router.use(authenticateMiddleware);

// Sign up new user
const user = await signupUser({ email, password, name });

// Generate JWT tokens
const { token, refreshToken } = await generateTokens(user);
\`\`\`

## Model Requirements

\`\`\`typescript
const schema = new mongoose.Schema({
  // your fields
}, {
  strict: "throw",  // Required: throw on unknown fields
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Use these instead of findOne
Model.findExactlyOne(query);   // Throws if not exactly one result
Model.findOneOrThrow(query);   // Throws if no result
Model.findOneOrNone(query);    // Returns null if no result
\`\`\`
`,
    description: "Complete documentation for the @terreno/api package",
    mimeType: "text/markdown",
    name: "@terreno/api Documentation",
    uri: "terreno://docs/api",
  },
  {
    content: `# @terreno/ui Documentation

Comprehensive React Native UI component library with cross-platform support (web, iOS, Android).

## Installation

\`\`\`bash
bun add @terreno/ui
\`\`\`

## Setup

Wrap your app with TerrenoProvider:

\`\`\`typescript
import { TerrenoProvider } from "@terreno/ui";

const App = () => (
  <TerrenoProvider>
    <YourApp />
  </TerrenoProvider>
);
\`\`\`

## Core Components

### Box (Layout Foundation)

The primary layout component. Use instead of View.

\`\`\`typescript
import { Box } from "@terreno/ui";

<Box
  direction="row"
  padding={4}
  gap={2}
  alignItems="center"
  justifyContent="between"
  backgroundColor="neutral100"
>
  <Text>Content</Text>
</Box>
\`\`\`

**Props:**
- \`direction\`: "row" | "column" (default: "column")
- \`padding\`, \`paddingX\`, \`paddingY\`: 0-12 (spacing scale)
- \`margin\`, \`marginX\`, \`marginY\`: 0-12
- \`gap\`: 0-12
- \`alignItems\`: "start" | "center" | "end" | "stretch"
- \`justifyContent\`: "start" | "center" | "end" | "between" | "around"
- \`flex\`: number
- \`backgroundColor\`: theme color key

### Button

\`\`\`typescript
import { Button } from "@terreno/ui";

<Button
  text="Submit"
  onClick={handleSubmit}
  variant="primary"
  loading={isLoading}
  disabled={!isValid}
  fullWidth
/>

<Button
  text="Delete"
  variant="destructive"
  withConfirmation
  confirmationTitle="Delete Item?"
  confirmationMessage="This cannot be undone."
/>
\`\`\`

**Variants:**
- \`primary\` - Default filled button
- \`secondary\` - Darker background
- \`outline\` - Border only
- \`ghost\` - Minimal, no background
- \`destructive\` - Red/error color
- \`muted\` - Light background

### Text & Typography

\`\`\`typescript
import { Text, Heading, Title } from "@terreno/ui";

<Title>Page Title</Title>
<Heading size="lg">Section Heading</Heading>
<Text size="md" color="neutral600">Body text</Text>
\`\`\`

### Form Fields

\`\`\`typescript
import {
  TextField,
  EmailField,
  PasswordField,
  NumberField,
  TextArea,
  SelectField,
  DateTimeField,
  BooleanField,
  CheckBox,
  RadioField,
} from "@terreno/ui";

<TextField
  label="Name"
  value={name}
  onChangeText={setName}
  placeholder="Enter your name"
  error={errors.name}
  helperText="Your full legal name"
/>

<SelectField
  label="Country"
  value={country}
  onChangeValue={setCountry}
  options={[
    { label: "United States", value: "US" },
    { label: "Canada", value: "CA" },
  ]}
/>

<DateTimeField
  label="Date of Birth"
  value={dob}
  onChange={setDob}
  mode="date"
/>

<BooleanField
  label="Accept Terms"
  value={accepted}
  onChangeValue={setAccepted}
/>
\`\`\`

### Modal & Sheets

\`\`\`typescript
import { Modal, ModalSheet, ActionSheet } from "@terreno/ui";

<Modal
  visible={showModal}
  title="Confirm Action"
  subtitle="Are you sure?"
  primaryButtonText="Confirm"
  secondaryButtonText="Cancel"
  onPrimaryAction={handleConfirm}
  onDismiss={() => setShowModal(false)}
>
  <Text>Modal content here</Text>
</Modal>

<ActionSheet
  visible={showSheet}
  title="Select Option"
  onDismiss={() => setShowSheet(false)}
>
  <Button text="Option 1" onClick={handleOption1} />
  <Button text="Option 2" onClick={handleOption2} />
</ActionSheet>
\`\`\`

### Table Components

\`\`\`typescript
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableText,
  TableDate,
  TableBadge,
} from "@terreno/ui";

<Table data={users} keyExtractor={(item) => item.id}>
  <TableHeader>
    <TableHeaderCell>Name</TableHeaderCell>
    <TableHeaderCell>Email</TableHeaderCell>
    <TableHeaderCell>Status</TableHeaderCell>
  </TableHeader>
  {users.map((user) => (
    <TableRow key={user.id} item={user}>
      <TableText field="name" />
      <TableText field="email" />
      <TableBadge field="status" />
    </TableRow>
  ))}
</Table>
\`\`\`

### Page & Layout

\`\`\`typescript
import { Page, SplitPage, ScrollView } from "@terreno/ui";

<Page
  navigation={navigation}
  title="Dashboard"
  headerRight={<IconButton name="settings" />}
>
  <ScrollView>
    {/* Content */}
  </ScrollView>
</Page>
\`\`\`

## Theme System

### Using Theme

\`\`\`typescript
import { useTheme } from "@terreno/ui";

const MyComponent = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Box backgroundColor={theme.colors.primary500}>
      <Text color={theme.colors.neutral100}>Themed content</Text>
    </Box>
  );
};
\`\`\`

### Theme Values

**Colors:**
- Primary: primary100-900
- Secondary: secondary100-900
- Accent: accent100-900
- Neutral: neutral100-900
- Error: error100-900
- Success: success100-900
- Warning: warning100-900

**Spacing (0-12):**
spacing0=0, spacing1=4, spacing2=8, spacing3=12, spacing4=16, spacing5=24, spacing6=32, spacing7=40, spacing8=48, spacing9=56, spacing10=64, spacing11=72, spacing12=80

**Border Radius:**
radiusSm, radiusMd, radiusLg, radiusXl, radius2xl, radius3xl

## Utilities

\`\`\`typescript
import { useStoredState, MediaQuery, isMobileDevice } from "@terreno/ui";

// Persist state to storage
const [value, setValue] = useStoredState("key", defaultValue);

// Responsive rendering
<MediaQuery minWidth={768}>
  <DesktopLayout />
</MediaQuery>

// Device detection
if (isMobileDevice()) {
  // Mobile-specific code
}
\`\`\`

## Icons

\`\`\`typescript
import { Icon, IconButton } from "@terreno/ui";

<Icon name="check" size={24} color="success500" />
<IconButton name="close" onClick={handleClose} />
\`\`\`

## Best Practices

1. Use \`Box\` as your primary layout component
2. Use theme values instead of hardcoded colors/spacing
3. Wrap callbacks with \`useCallback\`
4. Use Luxon for dates (not Date or dayjs)
5. Provide explicit return types on components
6. Use \`React.FC\` for component typing
`,
    description: "Complete documentation for the @terreno/ui package",
    mimeType: "text/markdown",
    name: "@terreno/ui Documentation",
    uri: "terreno://docs/ui",
  },
  {
    content: `# @terreno/rtk Documentation

Redux Toolkit Query utilities for frontends connecting to @terreno/api backends.

## Key Exports

- \`emptyApi\` - Base RTK Query API configured with axios
- \`authSlice\` - Redux slice for auth state
- \`generateProfileEndpoints\` - Auth endpoint builder
- Token utilities: \`getTokenExpirationTimes()\`, \`getFriendlyExpirationInfo()\`, \`getAuthToken()\`

## Setup

### Store Configuration

\`\`\`typescript
import { configureStore } from "@reduxjs/toolkit";
import { emptyApi, authSlice } from "@terreno/rtk";
import { openApiSdk } from "./openApiSdk";

export const store = configureStore({
  reducer: {
    [openApiSdk.reducerPath]: openApiSdk.reducer,
    auth: authSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(openApiSdk.middleware),
});
\`\`\`

### SDK Generation

The SDK is auto-generated from your backend's OpenAPI spec:

\`\`\`typescript
// openApiSdk.ts - AUTO-GENERATED, DO NOT EDIT
import { emptyApi } from "@terreno/rtk";

export const openApiSdk = emptyApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<User[], GetUsersParams>({
      query: (params) => ({ url: "/users", params }),
    }),
    createUser: build.mutation<User, CreateUserBody>({
      query: (body) => ({ url: "/users", method: "POST", body }),
    }),
  }),
});

export const { useGetUsersQuery, useCreateUserMutation } = openApiSdk;
\`\`\`

## Using the SDK

\`\`\`typescript
import { useGetUsersQuery, useCreateUserMutation } from "@/store/openApiSdk";

const UserList = () => {
  const { data: users, isLoading, error } = useGetUsersQuery({ limit: 10 });
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();

  const handleCreate = async () => {
    try {
      const newUser = await createUser({ name: "John", email: "john@example.com" }).unwrap();
      console.info("Created user:", newUser);
    } catch (err) {
      console.error("Failed to create user:", err);
    }
  };

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error loading users</Text>;

  return (
    <Box>
      {users?.map((user) => (
        <Text key={user.id}>{user.name}</Text>
      ))}
      <Button text="Add User" onClick={handleCreate} loading={isCreating} />
    </Box>
  );
};
\`\`\`

## Authentication

### Login

\`\`\`typescript
import { useEmailLoginMutation } from "@/store/openApiSdk";
import { useAppDispatch } from "@/store";
import { authSlice } from "@terreno/rtk";

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLogin, { isLoading, error }] = useEmailLoginMutation();
  const dispatch = useAppDispatch();

  const handleLogin = async () => {
    try {
      const result = await emailLogin({ email, password }).unwrap();
      // Auth state is automatically updated
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <Box padding={4} gap={3}>
      <EmailField label="Email" value={email} onChangeText={setEmail} />
      <PasswordField label="Password" value={password} onChangeText={setPassword} />
      <Button text="Login" onClick={handleLogin} loading={isLoading} />
    </Box>
  );
};
\`\`\`

### Auth State

\`\`\`typescript
import { useAppSelector } from "@/store";

const Component = () => {
  const userId = useAppSelector((state) => state.auth.userId);
  const isAuthenticated = !!userId;

  // ...
};
\`\`\`

### Logout

\`\`\`typescript
import { LOGOUT_ACTION_TYPE } from "@terreno/rtk";

const handleLogout = () => {
  dispatch({ type: LOGOUT_ACTION_TYPE });
};
\`\`\`

## Token Management

Tokens are automatically managed:
- Stored in \`expo-secure-store\` (mobile) or AsyncStorage (web)
- Auto-refresh with exponential backoff
- Mutex-protected to prevent race conditions

\`\`\`typescript
import { getAuthToken, getTokenExpirationTimes } from "@terreno/rtk";

// Get current token
const token = await getAuthToken();

// Check expiration
const { accessTokenExpiry, refreshTokenExpiry } = getTokenExpirationTimes(token);
\`\`\`

## Platform Detection

\`\`\`typescript
import { IsWeb, IsNative } from "@terreno/rtk";

if (IsWeb) {
  // Web-specific code
}

if (IsNative) {
  // Mobile-specific code
}
\`\`\`

## Best Practices

1. **Never use axios directly** - Always use generated SDK hooks
2. **Don't modify generated SDK** - It's auto-generated from OpenAPI spec
3. **Use .unwrap()** for mutations to get the result or throw error
4. **Handle loading and error states** in your UI
5. **Use TypeScript** - The SDK provides full type safety
`,
    description: "Complete documentation for the @terreno/rtk package",
    mimeType: "text/markdown",
    name: "@terreno/rtk Documentation",
    uri: "terreno://docs/rtk",
  },
  {
    content: `# Terreno Patterns & Best Practices

## Backend Patterns

### Model Definition

\`\`\`typescript
import mongoose from "mongoose";
import { addDefaultPlugins } from "@terreno/api";

interface TodoDocument extends mongoose.Document {
  title: string;
  completed: boolean;
  ownerId: mongoose.Types.ObjectId;
  created: Date;
  updated: Date;
}

interface TodoModel extends mongoose.Model<TodoDocument> {
  findByOwner(ownerId: string): Promise<TodoDocument[]>;
}

const todoSchema = new mongoose.Schema<TodoDocument, TodoModel>(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    strict: "throw",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

addDefaultPlugins(todoSchema);

todoSchema.statics.findByOwner = async function (ownerId: string) {
  return this.find({ ownerId });
};

export const Todo = mongoose.model<TodoDocument, TodoModel>("Todo", todoSchema);
\`\`\`

### Route Setup

\`\`\`typescript
import { Router } from "express";
import { modelRouter, Permissions, OwnerQueryFilter } from "@terreno/api";
import { Todo, TodoDocument } from "../models/todo";
import { UserDocument } from "../models/user";

export const addTodoRoutes = (router: Router) => {
  router.use(
    "/todos",
    modelRouter(Todo, {
      permissions: {
        create: [Permissions.IsAuthenticated],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsOwner],
        update: [Permissions.IsOwner],
        delete: [Permissions.IsOwner],
      },
      queryFields: ["completed"],
      queryFilter: OwnerQueryFilter,
      sort: "-created",
      preCreate: (body, req) => ({
        ...body,
        ownerId: (req.user as UserDocument)?._id,
      }),
      postCreate: async (todo, req) => {
        // Send notification, update stats, etc.
        logger.info("Todo created", { todoId: todo._id });
      },
    })
  );
};
\`\`\`

### Custom Endpoints

\`\`\`typescript
import { createOpenApiBuilder, APIError, authenticateMiddleware } from "@terreno/api";

const toggleCompleteBuilder = createOpenApiBuilder()
  .withTags(["Todos"])
  .withSummary("Toggle todo completion status")
  .withResponse(200, TodoSchema);

router.post(
  "/todos/:id/toggle",
  authenticateMiddleware,
  toggleCompleteBuilder.build(),
  async (req, res, next) => {
    try {
      const todo = await Todo.findOneOrThrow({ _id: req.params.id });

      if (!todo.ownerId.equals((req.user as UserDocument)._id)) {
        throw new APIError({
          status: 403,
          title: "Forbidden",
          detail: "You do not own this todo",
        });
      }

      todo.completed = !todo.completed;
      await todo.save();

      res.json(todo);
    } catch (error) {
      next(error);
    }
  }
);
\`\`\`

## Frontend Patterns

### Screen with Data Fetching

\`\`\`typescript
import React, { useCallback, useState } from "react";
import { Box, Page, Text, Button, TextField, ScrollView } from "@terreno/ui";
import { useGetTodosQuery, useCreateTodoMutation } from "@/store/openApiSdk";

const TodoScreen: React.FC = () => {
  const [newTitle, setNewTitle] = useState("");
  const { data: todos, isLoading, error, refetch } = useGetTodosQuery({});
  const [createTodo, { isLoading: isCreating }] = useCreateTodoMutation();

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) {
      return;
    }

    try {
      await createTodo({ title: newTitle }).unwrap();
      setNewTitle("");
    } catch (err) {
      console.error("Failed to create todo:", err);
    }
  }, [newTitle, createTodo]);

  if (isLoading) {
    return (
      <Page navigation={undefined}>
        <Box flex={1} alignItems="center" justifyContent="center">
          <Text>Loading...</Text>
        </Box>
      </Page>
    );
  }

  if (error) {
    return (
      <Page navigation={undefined}>
        <Box flex={1} alignItems="center" justifyContent="center" gap={2}>
          <Text color="error500">Failed to load todos</Text>
          <Button text="Retry" onClick={refetch} />
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={undefined} title="Todos">
      <ScrollView>
        <Box padding={4} gap={3}>
          <Box direction="row" gap={2}>
            <Box flex={1}>
              <TextField
                placeholder="New todo..."
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </Box>
            <Button
              text="Add"
              onClick={handleCreate}
              loading={isCreating}
              disabled={!newTitle.trim()}
            />
          </Box>

          {todos?.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </Box>
      </ScrollView>
    </Page>
  );
};

export default TodoScreen;
\`\`\`

### Form with Validation

\`\`\`typescript
import React, { useCallback, useState } from "react";
import { Box, Button, TextField, EmailField, Text } from "@terreno/ui";
import { useCreateUserMutation } from "@/store/openApiSdk";

interface FormErrors {
  name?: string;
  email?: string;
}

const CreateUserForm: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [createUser, { isLoading }] = useCreateUserMutation();

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      return;
    }

    try {
      await createUser({ name, email }).unwrap();
      // Success - navigate or show message
    } catch (err: any) {
      if (err.data?.fields) {
        setErrors(err.data.fields);
      }
    }
  }, [name, email, validate, createUser]);

  return (
    <Box padding={4} gap={3}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        error={errors.name}
      />
      <EmailField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <Button
        text="Create User"
        onClick={handleSubmit}
        loading={isLoading}
        fullWidth
      />
    </Box>
  );
};
\`\`\`

## Error Handling

### Backend

\`\`\`typescript
import { APIError } from "@terreno/api";

// Validation error with field-specific messages
throw new APIError({
  status: 400,
  title: "Validation Error",
  detail: "Please fix the following errors",
  code: "VALIDATION_ERROR",
  fields: {
    email: "Email already exists",
    password: "Password must be at least 8 characters",
  },
});

// Not found
throw new APIError({
  status: 404,
  title: "Not Found",
  detail: "The requested resource was not found",
});

// Permission denied
throw new APIError({
  status: 403,
  title: "Forbidden",
  detail: "You do not have permission to perform this action",
});
\`\`\`

### Frontend

\`\`\`typescript
try {
  await someApiCall().unwrap();
} catch (err: any) {
  // Handle field-specific errors
  if (err.data?.fields) {
    setErrors(err.data.fields);
    return;
  }

  // Handle general errors
  const message = err.data?.detail || err.message || "An error occurred";
  toast.error(message);
}
\`\`\`

## Code Style Checklist

- [ ] Use ES module syntax
- [ ] Use const arrow functions
- [ ] Use Luxon for dates
- [ ] Use interfaces over types
- [ ] No enums (use maps)
- [ ] Named exports preferred
- [ ] RORO pattern for complex functions
- [ ] Early returns for error conditions
- [ ] No nested if statements (prefer early return)
- [ ] Multiline syntax with braces for conditionals
- [ ] \`console.log\` only for debugging
- [ ] Wrap callbacks with useCallback
- [ ] Provide explicit return types
`,
    description: "Common patterns and best practices for Terreno development",
    mimeType: "text/markdown",
    name: "Terreno Patterns & Best Practices",
    uri: "terreno://docs/patterns",
  },
];
