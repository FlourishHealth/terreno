import type {Tool} from "@modelcontextprotocol/sdk/types.js";

export const tools: Tool[] = [
  {
    description:
      "Generate a Mongoose model with proper Terreno conventions including schema, interfaces, and plugins",
    inputSchema: {
      properties: {
        fields: {
          description: "Array of field definitions",
          items: {
            properties: {
              default: {
                description: "Default value (as string)",
                type: "string",
              },
              name: {description: "Field name", type: "string"},
              ref: {
                description: "Reference model name for ObjectId fields",
                type: "string",
              },
              required: {description: "Is the field required?", type: "boolean"},
              type: {
                description: "Field type: String, Number, Boolean, Date, ObjectId, Array, Mixed",
                type: "string",
              },
              unique: {description: "Is the field unique?", type: "boolean"},
            },
            required: ["name", "type"],
            type: "object",
          },
          type: "array",
        },
        hasOwner: {
          description: "Add ownerId field referencing User model",
          type: "boolean",
        },
        name: {
          description: "The model name (e.g., 'Todo', 'User', 'Product')",
          type: "string",
        },
        softDelete: {
          description: "Enable soft delete with isDeleted field",
          type: "boolean",
        },
      },
      required: ["name", "fields"],
      type: "object",
    },
    name: "generate_model",
  },
  {
    description: "Generate a modelRouter route configuration for a Mongoose model",
    inputSchema: {
      properties: {
        modelName: {
          description: "The model name (e.g., 'Todo')",
          type: "string",
        },
        ownerFiltered: {
          description: "Filter queries by owner",
          type: "boolean",
        },
        permissions: {
          description: "Permission configuration",
          properties: {
            create: {description: "Permission for create", type: "string"},
            delete: {description: "Permission for delete", type: "string"},
            list: {description: "Permission for list", type: "string"},
            read: {description: "Permission for read", type: "string"},
            update: {description: "Permission for update", type: "string"},
          },
          type: "object",
        },
        queryFields: {
          description: "Fields allowed in query filters",
          items: {type: "string"},
          type: "array",
        },
        routePath: {
          description: "The route path (e.g., '/todos')",
          type: "string",
        },
        sort: {
          description: "Default sort field (prefix with - for descending)",
          type: "string",
        },
      },
      required: ["modelName", "routePath"],
      type: "object",
    },
    name: "generate_route",
  },
  {
    description: "Generate a React Native screen component using @terreno/ui components",
    inputSchema: {
      properties: {
        fields: {
          description: "Fields to display or edit",
          items: {type: "string"},
          type: "array",
        },
        modelName: {
          description: "Model name for data fetching (e.g., 'Todo')",
          type: "string",
        },
        name: {
          description: "Screen name (e.g., 'TodoList', 'UserProfile')",
          type: "string",
        },
        type: {
          description: "Type of screen to generate",
          enum: ["list", "detail", "form", "empty"],
          type: "string",
        },
      },
      required: ["name", "type"],
      type: "object",
    },
    name: "generate_screen",
  },
  {
    description: "Generate form field components for a data model",
    inputSchema: {
      properties: {
        fields: {
          description: "Array of field definitions",
          items: {
            properties: {
              label: {description: "Display label", type: "string"},
              name: {description: "Field name", type: "string"},
              options: {
                description: "Options for select fields",
                items: {
                  properties: {
                    label: {type: "string"},
                    value: {type: "string"},
                  },
                  type: "object",
                },
                type: "array",
              },
              required: {description: "Is field required?", type: "boolean"},
              type: {
                description: "Field type for form input",
                enum: [
                  "text",
                  "email",
                  "password",
                  "number",
                  "textarea",
                  "select",
                  "boolean",
                  "date",
                  "datetime",
                ],
                type: "string",
              },
            },
            required: ["name", "type"],
            type: "object",
          },
          type: "array",
        },
      },
      required: ["fields"],
      type: "object",
    },
    name: "generate_form_fields",
  },
  {
    description: "Validate a Mongoose schema follows Terreno conventions",
    inputSchema: {
      properties: {
        schema: {
          description: "The schema code to validate",
          type: "string",
        },
      },
      required: ["schema"],
      type: "object",
    },
    name: "validate_model_schema",
  },
];

const generateModel = (args: {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    unique?: boolean;
    ref?: string;
    default?: string;
  }>;
  hasOwner?: boolean;
  softDelete?: boolean;
}): string => {
  const {name, fields, hasOwner, softDelete} = args;
  const lowerName = name.toLowerCase();

  const interfaceFields = fields
    .map((f) => {
      let tsType = "string";
      if (f.type === "Number") tsType = "number";
      else if (f.type === "Boolean") tsType = "boolean";
      else if (f.type === "Date") tsType = "Date";
      else if (f.type === "ObjectId") tsType = "mongoose.Types.ObjectId";
      else if (f.type === "Array") tsType = "unknown[]";

      return `  ${f.name}${f.required ? "" : "?"}: ${tsType};`;
    })
    .join("\n");

  const schemaFields = fields
    .map((f) => {
      const props: string[] = [
        `type: ${f.type === "ObjectId" ? "mongoose.Schema.Types.ObjectId" : f.type}`,
      ];
      if (f.required) props.push("required: true");
      if (f.unique) props.push("unique: true");
      if (f.ref) props.push(`ref: "${f.ref}"`);
      if (f.default !== undefined) {
        props.push(`default: ${f.default}`);
      }
      if (f.type === "String") props.push("trim: true");

      return `    ${f.name}: { ${props.join(", ")} },`;
    })
    .join("\n");

  const ownerField = hasOwner
    ? `    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },\n`
    : "";

  const ownerInterface = hasOwner ? `  ownerId: mongoose.Types.ObjectId;\n` : "";

  const plugins = softDelete ? `\n${lowerName}Schema.plugin(isDeletedPlugin);` : "";

  return `import mongoose from "mongoose";
import { addDefaultPlugins${softDelete ? ", isDeletedPlugin" : ""} } from "@terreno/api";

interface ${name}Document extends mongoose.Document {
${interfaceFields}
${ownerInterface}  created: Date;
  updated: Date;
}

interface ${name}Model extends mongoose.Model<${name}Document> {
  // Add static methods here
}

const ${lowerName}Schema = new mongoose.Schema<${name}Document, ${name}Model>(
  {
${schemaFields}
${ownerField}  },
  {
    strict: "throw",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

addDefaultPlugins(${lowerName}Schema);${plugins}

export const ${name} = mongoose.model<${name}Document, ${name}Model>("${name}", ${lowerName}Schema);
export type { ${name}Document, ${name}Model };
`;
};

const generateRoute = (args: {
  modelName: string;
  routePath: string;
  permissions?: {
    create?: string;
    list?: string;
    read?: string;
    update?: string;
    delete?: string;
  };
  queryFields?: string[];
  ownerFiltered?: boolean;
  sort?: string;
}): string => {
  const {modelName, routePath, permissions, queryFields, ownerFiltered, sort} = args;
  const lowerName = modelName.toLowerCase();

  const permMap: Record<string, string> = {
    admin: "Permissions.IsAdmin",
    any: "Permissions.IsAny",
    authenticated: "Permissions.IsAuthenticated",
    authOrReadOnly: "Permissions.IsAuthenticatedOrReadOnly",
    owner: "Permissions.IsOwner",
  };

  const getPerm = (p?: string) => permMap[p ?? "authenticated"] ?? "Permissions.IsAuthenticated";

  const permConfig = permissions
    ? `
      permissions: {
        create: [${getPerm(permissions.create)}],
        list: [${getPerm(permissions.list)}],
        read: [${getPerm(permissions.read)}],
        update: [${getPerm(permissions.update)}],
        delete: [${getPerm(permissions.delete)}],
      },`
    : `
      permissions: {
        create: [Permissions.IsAuthenticated],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsAuthenticated],
        update: [Permissions.IsAuthenticated],
        delete: [Permissions.IsAuthenticated],
      },`;

  const queryFieldsConfig = queryFields?.length
    ? `\n      queryFields: ${JSON.stringify(queryFields)},`
    : "";

  const ownerConfig = ownerFiltered
    ? `
      queryFilter: OwnerQueryFilter,
      preCreate: (body, req) => ({
        ...body,
        ownerId: (req.user as UserDocument)?._id,
      }),`
    : "";

  const sortConfig = sort ? `\n      sort: "${sort}",` : "";

  const imports = ownerFiltered
    ? `import { modelRouter, Permissions, OwnerQueryFilter } from "@terreno/api";
import { ${modelName}, ${modelName}Document } from "../models/${lowerName}";
import { UserDocument } from "../models/user";`
    : `import { modelRouter, Permissions } from "@terreno/api";
import { ${modelName} } from "../models/${lowerName}";`;

  return `import { Router } from "express";
${imports}

export const add${modelName}Routes = (router: Router) => {
  router.use(
    "${routePath}",
    modelRouter(${modelName}, {${permConfig}${queryFieldsConfig}${ownerConfig}${sortConfig}
    })
  );
};
`;
};

const generateScreen = (args: {
  name: string;
  type: "list" | "detail" | "form" | "empty";
  modelName?: string;
  fields?: string[];
}): string => {
  const {name, type, modelName, fields} = args;

  if (type === "empty") {
    return `import React from "react";
import { Box, Page, Text } from "@terreno/ui";

const ${name}Screen: React.FC = () => {
  return (
    <Page navigation={undefined} title="${name}">
      <Box padding={4}>
        <Text>Content goes here</Text>
      </Box>
    </Page>
  );
};

export default ${name}Screen;
`;
  }

  if (type === "list" && modelName) {
    const pluralLower = `${modelName.toLowerCase()}s`;
    return `import React, { useCallback } from "react";
import { Box, Page, Text, Button, ScrollView } from "@terreno/ui";
import { useGet${modelName}sQuery } from "@/store/openApiSdk";

const ${name}Screen: React.FC = () => {
  const { data: ${pluralLower}, isLoading, error, refetch } = useGet${modelName}sQuery({});

  if (isLoading) {
    return (
      <Page navigation={undefined} title="${name}">
        <Box flex={1} alignItems="center" justifyContent="center">
          <Text>Loading...</Text>
        </Box>
      </Page>
    );
  }

  if (error) {
    return (
      <Page navigation={undefined} title="${name}">
        <Box flex={1} alignItems="center" justifyContent="center" gap={2}>
          <Text color="error500">Failed to load data</Text>
          <Button text="Retry" onClick={refetch} />
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={undefined} title="${name}">
      <ScrollView>
        <Box padding={4} gap={2}>
          {${pluralLower}?.map((item) => (
            <Box key={item.id} padding={3} backgroundColor="neutral100" borderRadius="md">
              <Text>{item.${fields?.[0] ?? "id"}}</Text>
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Page>
  );
};

export default ${name}Screen;
`;
  }

  if (type === "form" && modelName) {
    const fieldStates = (fields ?? ["name"])
      .map((f) => `  const [${f}, set${f.charAt(0).toUpperCase() + f.slice(1)}] = useState("");`)
      .join("\n");

    const fieldInputs = (fields ?? ["name"])
      .map(
        (f) => `          <TextField
            label="${f.charAt(0).toUpperCase() + f.slice(1)}"
            value={${f}}
            onChangeText={set${f.charAt(0).toUpperCase() + f.slice(1)}}
            error={errors.${f}}
          />`
      )
      .join("\n");

    const bodyFields = (fields ?? ["name"]).map((f) => `${f}`).join(", ");

    return `import React, { useCallback, useState } from "react";
import { Box, Page, Button, TextField } from "@terreno/ui";
import { useCreate${modelName}Mutation } from "@/store/openApiSdk";

interface FormErrors {
  ${(fields ?? ["name"]).map((f) => `${f}?: string;`).join("\n  ")}
}

const ${name}Screen: React.FC = () => {
${fieldStates}
  const [errors, setErrors] = useState<FormErrors>({});
  const [create${modelName}, { isLoading }] = useCreate${modelName}Mutation();

  const handleSubmit = useCallback(async () => {
    const newErrors: FormErrors = {};
    ${(fields ?? ["name"]).map((f) => `if (!${f}.trim()) newErrors.${f} = "${f.charAt(0).toUpperCase() + f.slice(1)} is required";`).join("\n    ")}

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await create${modelName}({ ${bodyFields} }).unwrap();
      // Success - navigate or show message
    } catch (err: any) {
      if (err.data?.fields) {
        setErrors(err.data.fields);
      }
    }
  }, [${bodyFields}, create${modelName}]);

  return (
    <Page navigation={undefined} title="Create ${modelName}">
      <Box padding={4} gap={3}>
${fieldInputs}
        <Button
          text="Create"
          onClick={handleSubmit}
          loading={isLoading}
          fullWidth
        />
      </Box>
    </Page>
  );
};

export default ${name}Screen;
`;
  }

  if (type === "detail" && modelName) {
    return `import React from "react";
import { Box, Page, Text, Button, ScrollView } from "@terreno/ui";
import { useGet${modelName}Query } from "@/store/openApiSdk";
import { useLocalSearchParams } from "expo-router";

const ${name}Screen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isLoading, error, refetch } = useGet${modelName}Query({ id: id! }, { skip: !id });

  if (isLoading) {
    return (
      <Page navigation={undefined} title="${name}">
        <Box flex={1} alignItems="center" justifyContent="center">
          <Text>Loading...</Text>
        </Box>
      </Page>
    );
  }

  if (error || !item) {
    return (
      <Page navigation={undefined} title="${name}">
        <Box flex={1} alignItems="center" justifyContent="center" gap={2}>
          <Text color="error500">Failed to load data</Text>
          <Button text="Retry" onClick={refetch} />
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={undefined} title="${name}">
      <ScrollView>
        <Box padding={4} gap={2}>
          ${(fields ?? ["id"]).map((f) => `<Text>{item.${f}}</Text>`).join("\n          ")}
        </Box>
      </ScrollView>
    </Page>
  );
};

export default ${name}Screen;
`;
  }

  return `// Screen type "${type}" not fully supported, using empty template
import React from "react";
import { Box, Page, Text } from "@terreno/ui";

const ${name}Screen: React.FC = () => {
  return (
    <Page navigation={undefined} title="${name}">
      <Box padding={4}>
        <Text>Content goes here</Text>
      </Box>
    </Page>
  );
};

export default ${name}Screen;
`;
};

const generateFormFields = (args: {
  fields: Array<{
    name: string;
    type: string;
    label?: string;
    required?: boolean;
    options?: Array<{label: string; value: string}>;
  }>;
}): string => {
  const {fields} = args;

  const imports = new Set(["Box"]);
  const fieldComponents: string[] = [];

  for (const field of fields) {
    const label = field.label ?? field.name.charAt(0).toUpperCase() + field.name.slice(1);
    const stateName = field.name;
    const setterName = `set${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`;

    switch (field.type) {
      case "text":
        imports.add("TextField");
        fieldComponents.push(`        <TextField
          label="${label}"
          value={${stateName}}
          onChangeText={${setterName}}
          ${field.required ? `error={errors.${field.name}}` : ""}
        />`);
        break;
      case "email":
        imports.add("EmailField");
        fieldComponents.push(`        <EmailField
          label="${label}"
          value={${stateName}}
          onChangeText={${setterName}}
          ${field.required ? `error={errors.${field.name}}` : ""}
        />`);
        break;
      case "password":
        imports.add("PasswordField");
        fieldComponents.push(`        <PasswordField
          label="${label}"
          value={${stateName}}
          onChangeText={${setterName}}
          ${field.required ? `error={errors.${field.name}}` : ""}
        />`);
        break;
      case "number":
        imports.add("NumberField");
        fieldComponents.push(`        <NumberField
          label="${label}"
          value={${stateName}}
          onChangeValue={${setterName}}
          ${field.required ? `error={errors.${field.name}}` : ""}
        />`);
        break;
      case "textarea":
        imports.add("TextArea");
        fieldComponents.push(`        <TextArea
          label="${label}"
          value={${stateName}}
          onChangeText={${setterName}}
          ${field.required ? `error={errors.${field.name}}` : ""}
        />`);
        break;
      case "select": {
        imports.add("SelectField");
        const optionsStr = field.options
          ? JSON.stringify(field.options, null, 2).replace(/\n/g, "\n          ")
          : "[]";
        fieldComponents.push(`        <SelectField
          label="${label}"
          value={${stateName}}
          onChangeValue={${setterName}}
          options={${optionsStr}}
          ${field.required ? `error={errors.${field.name}}` : ""}
        />`);
        break;
      }
      case "boolean":
        imports.add("BooleanField");
        fieldComponents.push(`        <BooleanField
          label="${label}"
          value={${stateName}}
          onChangeValue={${setterName}}
        />`);
        break;
      case "date":
      case "datetime":
        imports.add("DateTimeField");
        fieldComponents.push(`        <DateTimeField
          label="${label}"
          value={${stateName}}
          onChange={${setterName}}
          mode="${field.type === "date" ? "date" : "datetime"}"
        />`);
        break;
    }
  }

  const stateDeclarations = fields
    .map((f) => {
      const defaultValue = f.type === "boolean" ? "false" : f.type === "number" ? "0" : '""';
      return `  const [${f.name}, set${f.name.charAt(0).toUpperCase() + f.name.slice(1)}] = useState(${defaultValue});`;
    })
    .join("\n");

  return `import React, { useState } from "react";
import { ${Array.from(imports).join(", ")} } from "@terreno/ui";

// State declarations (add to your component):
${stateDeclarations}

// Form fields (add inside your component's return):
{/* Form Fields */}
<Box gap={3}>
${fieldComponents.join("\n")}
</Box>
`;
};

const validateModelSchema = (args: {schema: string}): string => {
  const {schema} = args;
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check for strict mode
  if (!schema.includes('strict: "throw"') && !schema.includes("strict: 'throw'")) {
    issues.push("Missing strict: 'throw' in schema options");
    suggestions.push("Add { strict: 'throw' } to schema options for better error handling");
  }

  // Check for virtuals
  if (
    !schema.includes("toJSON: { virtuals: true }") &&
    !schema.includes("toJSON: {virtuals: true}")
  ) {
    issues.push("Missing toJSON virtuals configuration");
    suggestions.push(
      "Add { toJSON: { virtuals: true }, toObject: { virtuals: true } } to schema options"
    );
  }

  // Check for plugins
  if (!schema.includes("addDefaultPlugins") && !schema.includes("createdUpdatedPlugin")) {
    issues.push("Missing default plugins");
    suggestions.push("Add addDefaultPlugins(schema) or manually add createdUpdatedPlugin");
  }

  // Check for interface
  if (!schema.includes("interface") || !schema.includes("Document")) {
    issues.push("Missing TypeScript interfaces");
    suggestions.push("Define interfaces for Document and Model types");
  }

  // Check for findOne usage
  if (
    schema.includes(".findOne(") &&
    !schema.includes("findOneOrThrow") &&
    !schema.includes("findOneOrNone")
  ) {
    issues.push("Using findOne instead of findOneOrThrow/findOneOrNone");
    suggestions.push("Replace findOne with findOneOrThrow or findOneOrNone for safer queries");
  }

  // Check for Date usage
  if (schema.includes("new Date(") || schema.includes("Date.now")) {
    issues.push("Using native Date instead of Luxon");
    suggestions.push("Use Luxon DateTime instead of native Date for date handling");
  }

  if (issues.length === 0) {
    return "✓ Schema follows Terreno conventions";
  }

  return `Schema Validation Results:

Issues Found:
${issues.map((i) => `- ${i}`).join("\n")}

Suggestions:
${suggestions.map((s) => `- ${s}`).join("\n")}`;
};

export const handleToolCall = (
  name: string,
  args: Record<string, unknown>
): {content: Array<{type: "text"; text: string}>} => {
  let result: string;

  switch (name) {
    case "generate_model":
      result = generateModel(args as Parameters<typeof generateModel>[0]);
      break;
    case "generate_route":
      result = generateRoute(args as Parameters<typeof generateRoute>[0]);
      break;
    case "generate_screen":
      result = generateScreen(args as Parameters<typeof generateScreen>[0]);
      break;
    case "generate_form_fields":
      result = generateFormFields(args as Parameters<typeof generateFormFields>[0]);
      break;
    case "validate_model_schema":
      result = validateModelSchema(args as Parameters<typeof validateModelSchema>[0]);
      break;
    default:
      result = `Unknown tool: ${name}`;
  }

  return {
    content: [{text: result, type: "text"}],
  };
};
