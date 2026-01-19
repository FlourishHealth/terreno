import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getDocsRoot = (): string => {
  if (process.env.TERRENO_MCP_DOCS_DIR) {
    return process.env.TERRENO_MCP_DOCS_DIR;
  }

  if (process.execPath) {
    return join(dirname(process.execPath), "docs");
  }

  return join(__dirname, "docs");
};

const loadMarkdown = (filename: string): string => {
  const filePath = join(getDocsRoot(), "prompts", filename);
  return readFileSync(filePath, "utf-8");
};

interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export const prompts: Prompt[] = [
  {
    arguments: [
      {
        description: "The feature/model name (e.g., 'Product', 'Order')",
        name: "name",
        required: true,
      },
      {
        description:
          "Comma-separated list of fields with types (e.g., 'title:string,price:number,active:boolean')",
        name: "fields",
        required: true,
      },
      {
        description: "Whether to add owner relationship (yes/no)",
        name: "hasOwner",
        required: false,
      },
    ],
    description:
      "Generate a complete CRUD feature including model, routes, and frontend screens for Terreno",
    name: "create_crud_feature",
  },
  {
    arguments: [
      {
        description: "The endpoint path (e.g., '/users/:id/verify')",
        name: "path",
        required: true,
      },
      {
        description: "HTTP method (GET, POST, PUT, PATCH, DELETE)",
        name: "method",
        required: true,
      },
      {
        description: "What the endpoint does",
        name: "description",
        required: true,
      },
    ],
    description: "Generate a custom API endpoint with OpenAPI documentation for @terreno/api",
    name: "create_api_endpoint",
  },
  {
    arguments: [
      {
        description: "Component name (e.g., 'UserCard', 'PriceTag')",
        name: "name",
        required: true,
      },
      {
        description: "Component type: display, interactive, form, layout",
        name: "type",
        required: true,
      },
    ],
    description: "Generate a reusable UI component using @terreno/ui patterns",
    name: "create_ui_component",
  },
  {
    arguments: [
      {
        description: "Screen name (e.g., 'CreateProduct', 'EditProfile')",
        name: "name",
        required: true,
      },
      {
        description:
          "Comma-separated list of form fields (e.g., 'name:text,email:email,bio:textarea')",
        name: "fields",
        required: true,
      },
      {
        description: "API endpoint name (e.g., 'createProduct', 'updateUser')",
        name: "endpoint",
        required: true,
      },
    ],
    description: "Generate a form screen with validation using @terreno/ui and RTK Query",
    name: "create_form_screen",
  },
  {
    arguments: [
      {
        description: "Comma-separated auth features: email,social,passwordReset",
        name: "features",
        required: false,
      },
    ],
    description:
      "Generate authentication setup including login/signup screens and auth state management",
    name: "add_authentication",
  },
  {
    arguments: [],
    description: "Get the Terreno code style guide and best practices for writing code",
    name: "terreno_style_guide",
  },
];

const createCrudFeaturePrompt = (args: {
  name: string;
  fields: string;
  hasOwner?: string;
}): string => {
  const {name, fields, hasOwner} = args;
  const hasOwnerBool = hasOwner?.toLowerCase() === "yes";

  const parsedFields = fields.split(",").map((f) => {
    const [fieldName, fieldType] = f.trim().split(":");
    return {name: fieldName, type: fieldType || "string"};
  });

  const fieldsList = parsedFields.map((f) => `- ${f.name}: ${f.type}`).join("\n");

  return `Generate a complete CRUD feature for "${name}" with the following specifications:

## Model Fields
${fieldsList}
${hasOwnerBool ? "- ownerId: ObjectId (reference to User, required)" : ""}

## Requirements

### Backend (using @terreno/api)

1. **Model File** (\`models/${name.toLowerCase()}.ts\`):
   - Create Mongoose schema with proper TypeScript interfaces
   - Use \`strict: "throw"\` and virtuals configuration
   - Add \`addDefaultPlugins()\` for timestamps
   ${hasOwnerBool ? "- Include ownerId field with User reference" : ""}

2. **Routes File** (\`routes/${name.toLowerCase()}.ts\`):
   - Use \`modelRouter\` for CRUD operations
   - Configure appropriate permissions:
     ${hasOwnerBool ? "- Use Permissions.IsOwner for read/update/delete" : "- Use Permissions.IsAuthenticated"}
     ${hasOwnerBool ? "- Add OwnerQueryFilter for list queries" : ""}
     ${hasOwnerBool ? "- Add preCreate hook to set ownerId" : ""}
   - Add queryFields for filterable fields
   - Set default sort order

### Frontend (using @terreno/ui and @terreno/rtk)

3. **List Screen** (\`screens/${name}ListScreen.tsx\`):
   - Use \`useGet${name}sQuery\` hook
   - Handle loading and error states
   - Display items in a scrollable list
   - Add pull-to-refresh functionality

4. **Detail Screen** (\`screens/${name}DetailScreen.tsx\`):
   - Use \`useGet${name}Query\` with id parameter
   - Display all fields
   - Add edit and delete buttons

5. **Form Screen** (\`screens/${name}FormScreen.tsx\`):
   - Create/Edit form with all fields
   - Client-side validation
   - Use \`useCreate${name}Mutation\` or \`useUpdate${name}Mutation\`
   - Handle API errors and display field-specific errors

## Code Style Requirements
- Use const arrow functions
- Use Luxon for dates
- Use interfaces (not types)
- Named exports
- RORO pattern for complex functions
- Early returns for error handling
- Wrap callbacks with useCallback`;
};

const createApiEndpointPrompt = (args: {
  path: string;
  method: string;
  description: string;
}): string => {
  const {path, method, description} = args;

  return `Generate a custom API endpoint for @terreno/api with the following specifications:

## Endpoint Details
- **Path**: ${path}
- **Method**: ${method.toUpperCase()}
- **Description**: ${description}

## Requirements

1. **OpenAPI Documentation**:
   - Use \`createOpenApiBuilder()\` for route documentation
   - Add appropriate tags, summary, and description
   - Document request body schema (if applicable)
   - Document query parameters (if applicable)
   - Document response schema with status codes

2. **Route Handler**:
   - Use async/await with proper error handling
   - Validate request data
   - Use \`APIError\` for error responses
   - Return appropriate HTTP status codes

3. **Authentication** (if needed):
   - Use \`authenticateMiddleware\` for protected routes
   - Check permissions as needed

## Example Structure

\`\`\`typescript
import { Router } from "express";
import { createOpenApiBuilder, APIError, authenticateMiddleware } from "@terreno/api";

const builder = createOpenApiBuilder()
  .withTags(["YourTag"])
  .withSummary("${description}")
  .withDescription("Detailed description here")
  // Add parameters, request body, responses as needed
  ;

router.${method.toLowerCase()}(
  "${path}",
  authenticateMiddleware, // if needed
  builder.build(),
  async (req, res, next) => {
    try {
      // Implementation here

      res.json({ /* response */ });
    } catch (error) {
      next(error);
    }
  }
);
\`\`\`

## Code Style
- Use const arrow functions
- Early returns for validation
- Proper TypeScript types
- Throw APIError with appropriate status, title, detail`;
};

const createUiComponentPrompt = (args: {name: string; type: string}): string => {
  const {name, type} = args;

  const typeGuide: Record<string, string> = {
    display: `Display components show data without user interaction.

Example patterns:
- Card layouts with Box, Text, and Image
- Status badges with conditional styling
- Data visualization with themed colors`,

    form: `Form components handle user input.

Example patterns:
- Controlled inputs with value/onChange
- Validation with error prop
- Label and helper text support`,

    interactive: `Interactive components handle user actions.

Example patterns:
- Button with variants and loading states
- Pressable areas with feedback
- Toggles and switches`,

    layout: `Layout components structure content.

Example patterns:
- Container with padding/margin
- Flex layouts with direction/gap
- Responsive wrappers with MediaQuery`,
  };

  return `Generate a reusable UI component for @terreno/ui with the following specifications:

## Component Details
- **Name**: ${name}
- **Type**: ${type}

## ${type.charAt(0).toUpperCase() + type.slice(1)} Component Guidelines
${typeGuide[type] || "Follow standard component patterns."}

## Requirements

1. **Component Structure**:
   - Use \`React.FC\` with explicit props interface
   - Export named component and props interface
   - Use @terreno/ui primitives (Box, Text, Button, etc.)

2. **Styling**:
   - Use theme values from \`useTheme()\`
   - Use spacing scale (0-12) for padding/margin
   - Use color tokens (primary500, neutral600, etc.)

3. **TypeScript**:
   - Define props interface with JSDoc comments
   - Use proper types for callbacks
   - Export component and types

4. **Performance**:
   - Wrap callbacks with \`useCallback\`
   - Use \`useMemo\` for expensive computations
   - Avoid inline object styles where possible

## Template

\`\`\`typescript
import React, { useCallback } from "react";
import { Box, Text } from "@terreno/ui";

interface ${name}Props {
  /** Primary content to display */
  children?: React.ReactNode;
  /** Optional callback when component is pressed */
  onPress?: () => void;
}

export const ${name}: React.FC<${name}Props> = ({ children, onPress }) => {
  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  return (
    <Box padding={3} backgroundColor="neutral100" borderRadius="md">
      {children}
    </Box>
  );
};
\`\`\`

## Code Style
- Use const arrow functions
- Named exports
- Explicit return types
- camelCase for props`;
};

const createFormScreenPrompt = (args: {name: string; fields: string; endpoint: string}): string => {
  const {name, fields, endpoint} = args;

  const parsedFields = fields.split(",").map((f) => {
    const [fieldName, fieldType] = f.trim().split(":");
    return {name: fieldName, type: fieldType || "text"};
  });

  const fieldsList = parsedFields.map((f) => `- ${f.name}: ${f.type}`).join("\n");

  const componentMap: Record<string, string> = {
    boolean: "BooleanField",
    date: "DateTimeField",
    email: "EmailField",
    number: "NumberField",
    password: "PasswordField",
    select: "SelectField",
    text: "TextField",
    textarea: "TextArea",
  };

  const components = [...new Set(parsedFields.map((f) => componentMap[f.type] || "TextField"))];

  return `Generate a form screen using @terreno/ui with the following specifications:

## Screen Details
- **Name**: ${name}Screen
- **API Endpoint**: use${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)}Mutation

## Form Fields
${fieldsList}

## Required Imports
\`\`\`typescript
import { ${components.join(", ")}, Box, Page, Button } from "@terreno/ui";
import { use${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)}Mutation } from "@/store/openApiSdk";
\`\`\`

## Requirements

1. **State Management**:
   - useState for each form field
   - useState for errors object
   - Type-safe error interface

2. **Validation**:
   - Validate required fields
   - Email format validation for email fields
   - Clear validation on field change

3. **Form Submission**:
   - Validate before submitting
   - Use mutation with .unwrap()
   - Handle API errors (extract field errors)
   - Show loading state on submit button

4. **Error Display**:
   - Show field-specific errors
   - Handle general API errors

## Example Structure

\`\`\`typescript
import React, { useCallback, useState } from "react";
import { Box, Page, Button, ${components.join(", ")} } from "@terreno/ui";
import { use${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)}Mutation } from "@/store/openApiSdk";

interface FormErrors {
  ${parsedFields.map((f) => `${f.name}?: string;`).join("\n  ")}
}

const ${name}Screen: React.FC = () => {
  ${parsedFields.map((f) => `const [${f.name}, set${f.name.charAt(0).toUpperCase() + f.name.slice(1)}] = useState(${f.type === "boolean" ? "false" : f.type === "number" ? "0" : '""'});`).join("\n  ")}
  const [errors, setErrors] = useState<FormErrors>({});
  const [${endpoint}, { isLoading }] = use${endpoint.charAt(0).toUpperCase() + endpoint.slice(1)}Mutation();

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    // Add validation logic
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [/* dependencies */]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    try {
      await ${endpoint}({ /* fields */ }).unwrap();
      // Success handling
    } catch (err: any) {
      if (err.data?.fields) {
        setErrors(err.data.fields);
      }
    }
  }, [validate, ${endpoint}]);

  return (
    <Page navigation={undefined} title="${name}">
      <Box padding={4} gap={3}>
        {/* Form fields here */}
        <Button text="Submit" onClick={handleSubmit} loading={isLoading} fullWidth />
      </Box>
    </Page>
  );
};

export default ${name}Screen;
\`\`\``;
};

const addAuthenticationPrompt = (args: {features?: string}): string => {
  const features = args.features?.split(",").map((f) => f.trim()) || ["email"];

  return `Generate authentication setup for a Terreno application with the following features:

## Features
${features.map((f) => `- ${f}`).join("\n")}

## Backend Setup (@terreno/api)

1. **User Model** (\`models/user.ts\`):
   - Use passport-local-mongoose plugin
   - Add baseUserPlugin for standard fields
   - Include email, name, and admin fields
   - Add custom methods (getDisplayName)

2. **Auth Configuration** (\`config/auth.ts\`):
   - Configure Passport strategies (local, JWT)
   - Set up session management
   - Configure token secrets from environment

3. **Auth Routes** (\`routes/auth.ts\`):
   - POST /auth/signup - Create new user
   - POST /auth/login - Email/password login
   - POST /auth/refresh - Refresh token
   - POST /auth/logout - Logout
   ${features.includes("passwordReset") ? "- POST /auth/forgot-password\n   - POST /auth/reset-password" : ""}

## Frontend Setup (@terreno/rtk, @terreno/ui)

4. **Store Configuration** (\`store/index.ts\`):
   - Import authSlice from @terreno/rtk
   - Configure store with auth reducer
   - Set up persist configuration

5. **Login Screen** (\`screens/LoginScreen.tsx\`):
   - Email and password fields
   - Login button with loading state
   - Error display
   - Link to signup

6. **Signup Screen** (\`screens/SignupScreen.tsx\`):
   - Name, email, password fields
   - Validation (email format, password strength)
   - Signup mutation
   - Error handling

${
  features.includes("passwordReset")
    ? `7. **Password Reset**:
   - Forgot password screen with email input
   - Reset password screen with token validation`
    : ""
}

## Auth State Management

\`\`\`typescript
// Check authentication
const userId = useAppSelector((state) => state.auth.userId);
const isAuthenticated = !!userId;

// Login
const [emailLogin] = useEmailLoginMutation();
await emailLogin({ email, password }).unwrap();

// Logout
dispatch({ type: LOGOUT_ACTION_TYPE });
\`\`\`

## Protected Routes

\`\`\`typescript
// In app navigation
if (!isAuthenticated) {
  return <Navigate to="/login" />;
}
\`\`\``;
};

const styleGuidePrompt = (): string => {
  return loadMarkdown("style-guide.md");
};

export const handlePromptRequest = (
  name: string,
  args: Record<string, string>
): {messages: Array<{role: "user"; content: {type: "text"; text: string}}>} => {
  let content: string;

  switch (name) {
    case "create_crud_feature":
      content = createCrudFeaturePrompt(args as Parameters<typeof createCrudFeaturePrompt>[0]);
      break;
    case "create_api_endpoint":
      content = createApiEndpointPrompt(args as Parameters<typeof createApiEndpointPrompt>[0]);
      break;
    case "create_ui_component":
      content = createUiComponentPrompt(args as Parameters<typeof createUiComponentPrompt>[0]);
      break;
    case "create_form_screen":
      content = createFormScreenPrompt(args as Parameters<typeof createFormScreenPrompt>[0]);
      break;
    case "add_authentication":
      content = addAuthenticationPrompt(args as Parameters<typeof addAuthenticationPrompt>[0]);
      break;
    case "terreno_style_guide":
      content = styleGuidePrompt();
      break;
    default:
      content = `Unknown prompt: ${name}`;
  }

  return {
    messages: [
      {
        content: {
          text: content,
          type: "text",
        },
        role: "user",
      },
    ],
  };
};
