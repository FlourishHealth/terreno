import {describe, expect, test} from "bun:test";
import {handleToolCall, tools} from "../tools.js";

describe("tools", () => {
  test("should export all required tools", () => {
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain("generate_model");
    expect(toolNames).toContain("generate_route");
    expect(toolNames).toContain("generate_screen");
    expect(toolNames).toContain("generate_form_fields");
    expect(toolNames).toContain("validate_model_schema");
  });

  test("should have valid tool structure", () => {
    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  describe("generate_model", () => {
    test("should generate basic model", () => {
      const result = handleToolCall("generate_model", {
        fields: [
          {name: "title", required: true, type: "String"},
          {name: "price", required: true, type: "Number"},
        ],
        name: "Product",
      });

      const content = result.content[0].text;

      expect(content).toContain("interface ProductDocument");
      expect(content).toContain("interface ProductModel");
      expect(content).toContain("productSchema");
      expect(content).toContain('strict: "throw"');
      expect(content).toContain("addDefaultPlugins");
      expect(content).toContain("title: { type: String");
      expect(content).toContain("price: { type: Number");
    });

    test("should generate model with owner", () => {
      const result = handleToolCall("generate_model", {
        fields: [{name: "title", required: true, type: "String"}],
        hasOwner: true,
        name: "Todo",
      });

      const content = result.content[0].text;

      expect(content).toContain("ownerId");
      expect(content).toContain('ref: "User"');
      expect(content).toContain("mongoose.Types.ObjectId");
    });

    test("should generate model with soft delete", () => {
      const result = handleToolCall("generate_model", {
        fields: [{name: "name", type: "String"}],
        name: "Item",
        softDelete: true,
      });

      const content = result.content[0].text;

      expect(content).toContain("isDeletedPlugin");
    });

    test("should handle field with reference", () => {
      const result = handleToolCall("generate_model", {
        fields: [{name: "userId", ref: "User", required: true, type: "ObjectId"}],
        name: "Order",
      });

      const content = result.content[0].text;

      expect(content).toContain("mongoose.Schema.Types.ObjectId");
      expect(content).toContain('ref: "User"');
    });

    test("should handle field with default value", () => {
      const result = handleToolCall("generate_model", {
        fields: [{default: "true", name: "active", type: "Boolean"}],
        name: "Setting",
      });

      const content = result.content[0].text;

      expect(content).toContain("default: true");
    });
  });

  describe("generate_route", () => {
    test("should generate basic route", () => {
      const result = handleToolCall("generate_route", {
        modelName: "Product",
        routePath: "/products",
      });

      const content = result.content[0].text;

      expect(content).toContain("addProductRoutes");
      expect(content).toContain("modelRouter");
      expect(content).toContain('"/products"');
      expect(content).toContain("Permissions.IsAuthenticated");
    });

    test("should generate route with custom permissions", () => {
      const result = handleToolCall("generate_route", {
        modelName: "Post",
        permissions: {
          create: "authenticated",
          delete: "admin",
          list: "any",
          read: "any",
          update: "owner",
        },
        routePath: "/posts",
      });

      const content = result.content[0].text;

      expect(content).toContain("Permissions.IsAny");
      expect(content).toContain("Permissions.IsOwner");
      expect(content).toContain("Permissions.IsAdmin");
    });

    test("should generate route with owner filter", () => {
      const result = handleToolCall("generate_route", {
        modelName: "Task",
        ownerFiltered: true,
        routePath: "/tasks",
      });

      const content = result.content[0].text;

      expect(content).toContain("OwnerQueryFilter");
      expect(content).toContain("preCreate");
      expect(content).toContain("ownerId");
      expect(content).toContain("UserDocument");
    });

    test("should generate route with query fields", () => {
      const result = handleToolCall("generate_route", {
        modelName: "Item",
        queryFields: ["status", "category"],
        routePath: "/items",
      });

      const content = result.content[0].text;

      expect(content).toContain('queryFields: ["status","category"]');
    });

    test("should generate route with sort", () => {
      const result = handleToolCall("generate_route", {
        modelName: "Event",
        routePath: "/events",
        sort: "-startDate",
      });

      const content = result.content[0].text;

      expect(content).toContain('sort: "-startDate"');
    });
  });

  describe("generate_screen", () => {
    test("should generate empty screen", () => {
      const result = handleToolCall("generate_screen", {
        name: "Dashboard",
        type: "empty",
      });

      const content = result.content[0].text;

      expect(content).toContain("DashboardScreen");
      expect(content).toContain("Page");
      expect(content).toContain("Box");
      expect(content).toContain("Text");
    });

    test("should generate list screen", () => {
      const result = handleToolCall("generate_screen", {
        fields: ["title", "price"],
        modelName: "Product",
        name: "ProductList",
        type: "list",
      });

      const content = result.content[0].text;

      expect(content).toContain("ProductListScreen");
      expect(content).toContain("useGetProductsQuery");
      expect(content).toContain("isLoading");
      expect(content).toContain("error");
      expect(content).toContain("refetch");
      expect(content).toContain("ScrollView");
    });

    test("should generate form screen", () => {
      const result = handleToolCall("generate_screen", {
        fields: ["title", "description"],
        modelName: "Product",
        name: "CreateProduct",
        type: "form",
      });

      const content = result.content[0].text;

      expect(content).toContain("CreateProductScreen");
      expect(content).toContain("useCreateProductMutation");
      expect(content).toContain("useState");
      expect(content).toContain("TextField");
      expect(content).toContain("handleSubmit");
      expect(content).toContain("FormErrors");
    });

    test("should generate detail screen", () => {
      const result = handleToolCall("generate_screen", {
        fields: ["title", "price", "description"],
        modelName: "Product",
        name: "ProductDetail",
        type: "detail",
      });

      const content = result.content[0].text;

      expect(content).toContain("ProductDetailScreen");
      expect(content).toContain("useGetProductQuery");
      expect(content).toContain("useLocalSearchParams");
      expect(content).toContain("item.title");
      expect(content).toContain("item.price");
    });
  });

  describe("generate_form_fields", () => {
    test("should generate text field", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{label: "Full Name", name: "name", type: "text"}],
      });

      const content = result.content[0].text;

      expect(content).toContain("TextField");
      expect(content).toContain('label="Full Name"');
      expect(content).toContain("value={name}");
      expect(content).toContain("onChangeText={setName}");
    });

    test("should generate email field", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{name: "email", required: true, type: "email"}],
      });

      const content = result.content[0].text;

      expect(content).toContain("EmailField");
      expect(content).toContain("error={errors.email}");
    });

    test("should generate select field with options", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [
          {
            name: "country",
            options: [
              {label: "USA", value: "us"},
              {label: "Canada", value: "ca"},
            ],
            type: "select",
          },
        ],
      });

      const content = result.content[0].text;

      expect(content).toContain("SelectField");
      expect(content).toContain("USA");
      expect(content).toContain("Canada");
      expect(content).toContain("onChangeValue={setCountry}");
    });

    test("should generate boolean field", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{name: "active", type: "boolean"}],
      });

      const content = result.content[0].text;

      expect(content).toContain("BooleanField");
      expect(content).toContain("useState(false)");
    });

    test("should generate date field", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{name: "birthDate", type: "date"}],
      });

      const content = result.content[0].text;

      expect(content).toContain("DateTimeField");
      expect(content).toContain('mode="date"');
    });

    test("should generate multiple fields", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [
          {name: "name", type: "text"},
          {name: "email", type: "email"},
          {name: "age", type: "number"},
        ],
      });

      const content = result.content[0].text;

      expect(content).toContain("TextField");
      expect(content).toContain("EmailField");
      expect(content).toContain("NumberField");
    });
  });

  describe("validate_model_schema", () => {
    test("should pass valid schema", () => {
      const validSchema = `
        const schema = new mongoose.Schema({
          name: { type: String }
        }, {
          strict: "throw",
          toJSON: { virtuals: true },
          toObject: { virtuals: true },
        });
        addDefaultPlugins(schema);
        interface MyDocument extends mongoose.Document {}
      `;

      const result = handleToolCall("validate_model_schema", {
        schema: validSchema,
      });

      expect(result.content[0].text).toContain("✓");
    });

    test("should detect missing strict throw", () => {
      const schema = `
        const schema = new mongoose.Schema({
          name: { type: String }
        });
      `;

      const result = handleToolCall("validate_model_schema", {schema});

      expect(result.content[0].text).toContain("strict");
    });

    test("should detect missing virtuals", () => {
      const schema = `
        const schema = new mongoose.Schema({}, {
          strict: "throw"
        });
      `;

      const result = handleToolCall("validate_model_schema", {schema});

      expect(result.content[0].text).toContain("virtuals");
    });

    test("should detect missing plugins", () => {
      const schema = `
        const schema = new mongoose.Schema({}, {
          strict: "throw",
          toJSON: { virtuals: true }
        });
      `;

      const result = handleToolCall("validate_model_schema", {schema});

      expect(result.content[0].text).toContain("plugins");
    });

    test("should detect findOne usage", () => {
      const schema = `
        schema.statics.findByEmail = function(email) {
          return this.findOne({ email });
        };
      `;

      const result = handleToolCall("validate_model_schema", {schema});

      expect(result.content[0].text).toContain("findOne");
      expect(result.content[0].text).toContain("findOneOrThrow");
    });

    test("should detect Date usage", () => {
      const schema = `
        const timestamp = new Date();
      `;

      const result = handleToolCall("validate_model_schema", {schema});

      expect(result.content[0].text).toContain("Luxon");
    });
  });

  describe("unknown tool", () => {
    test("should return error for unknown tool", () => {
      const result = handleToolCall("unknown_tool", {});

      expect(result.content[0].text).toContain("Unknown tool");
    });
  });

  describe("generate_model edge cases", () => {
    test("should generate interface types for non-string fields", () => {
      const result = handleToolCall("generate_model", {
        fields: [
          {name: "count", required: true, type: "Number"},
          {name: "isActive", required: true, type: "Boolean"},
          {name: "startDate", required: false, type: "Date"},
          {name: "ownerId", ref: "User", required: true, type: "ObjectId"},
          {name: "tags", required: false, type: "Array"},
        ],
        name: "Event",
      });
      const content = result.content[0].text;

      expect(content).toContain("count: number");
      expect(content).toContain("isActive: boolean");
      expect(content).toContain("startDate?: Date");
      expect(content).toContain("ownerId: mongoose.Types.ObjectId");
      expect(content).toContain("tags?: unknown[]");
      expect(content).toContain('ref: "User"');
    });

    test("should support hasOwner and softDelete options", () => {
      const result = handleToolCall("generate_model", {
        fields: [{name: "title", required: true, type: "String"}],
        hasOwner: true,
        name: "Article",
        softDelete: true,
      });
      const content = result.content[0].text;

      expect(content).toContain("ownerId: mongoose.Types.ObjectId");
      expect(content).toContain('ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User"');
      expect(content).toContain("isDeletedPlugin");
      expect(content).toContain("articleSchema.plugin(isDeletedPlugin)");
    });

    test("should support unique and default field props", () => {
      const result = handleToolCall("generate_model", {
        fields: [
          {name: "email", required: true, type: "String", unique: true},
          {default: "0", name: "count", required: false, type: "Number"},
        ],
        name: "Account",
      });
      const content = result.content[0].text;

      expect(content).toContain("unique: true");
      expect(content).toContain("default: 0");
    });
  });

  describe("generate_route edge cases", () => {
    test("should generate route with ownerFiltered", () => {
      const result = handleToolCall("generate_route", {
        modelName: "Task",
        ownerFiltered: true,
        permissions: {
          create: "owner",
          delete: "admin",
          list: "any",
          read: "authOrReadOnly",
          update: "authenticated",
        },
        queryFields: ["title", "status"],
        routePath: "/tasks",
      });
      const content = result.content[0].text;

      expect(content).toContain("OwnerQueryFilter");
      expect(content).toContain("UserDocument");
      expect(content).toContain("Permissions.IsOwner");
      expect(content).toContain("Permissions.IsAdmin");
      expect(content).toContain("Permissions.IsAny");
      expect(content).toContain("Permissions.IsAuthenticatedOrReadOnly");
      expect(content).toContain('queryFields: ["title","status"]');
      expect(content).toContain("preCreate");
    });
  });

  describe("generate_screen edge cases", () => {
    test("should fall back to empty template when type needs modelName but none given", () => {
      const result = handleToolCall("generate_screen", {
        name: "Orphan",
        type: "list",
      });
      const content = result.content[0].text;

      expect(content).toContain('Screen type "list" not fully supported');
      expect(content).toContain("OrphanScreen");
    });
  });

  describe("generate_form_fields edge cases", () => {
    test("should generate password field", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{label: "Password", name: "password", required: true, type: "password"}],
      });
      const content = result.content[0].text;

      expect(content).toContain("PasswordField");
      expect(content).toContain('label="Password"');
      expect(content).toContain("error={errors.password}");
    });

    test("should generate textarea field", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{name: "bio", type: "textarea"}],
      });
      const content = result.content[0].text;

      expect(content).toContain("TextArea");
    });

    test("should generate datetime field", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{name: "scheduledAt", type: "datetime"}],
      });
      const content = result.content[0].text;

      expect(content).toContain("DateTimeField");
      expect(content).toContain('mode="datetime"');
    });

    test("should generate select field with empty options", () => {
      const result = handleToolCall("generate_form_fields", {
        fields: [{name: "category", type: "select"}],
      });
      const content = result.content[0].text;

      expect(content).toContain("SelectField");
      expect(content).toContain("options={[]}");
    });
  });

  describe("install_admin", () => {
    test("should generate admin panel files and instructions", () => {
      const result = handleToolCall("install_admin", {
        models: [
          {
            displayName: "Todos",
            listFields: ["title", "completed"],
            modelName: "Todo",
            routePath: "/todos",
          },
          {
            displayName: "Users",
            listFields: ["email"],
            modelName: "User",
            routePath: "/users",
          },
        ],
      });
      const content = result.content[0].text;

      expect(content).toContain("# Install Admin Panel");
      expect(content).toContain("frontend/app/(tabs)/admin/index.tsx");
      expect(content).toContain("frontend/app/(tabs)/admin/[model].tsx");
      expect(content).toContain("frontend/app/(tabs)/admin/[model]/create.tsx");
      expect(content).toContain("frontend/app/(tabs)/admin/[model]/[id].tsx");
      expect(content).toContain("AdminModelList");
      expect(content).toContain("AdminModelTable");
      expect(content).toContain("AdminModelForm");
      expect(content).toContain("@terreno/admin-backend");
      expect(content).toContain("@terreno/admin-frontend");
      expect(content).toContain("import {Todo, User} from");
      expect(content).toContain('displayName: "Todos"');
      expect(content).toContain('routePath: "/todos"');
      expect(content).toContain('["title","completed"]');
    });
  });

  describe("handleToolCall - bootstrap dispatch", () => {
    test("should delegate bootstrap_app to bootstrap handler", () => {
      const result = handleToolCall("bootstrap_app", {
        appDisplayName: "Dispatch App",
        appName: "dispatch-app",
      });
      expect(result.content[0].text).toContain("# Bootstrap Dispatch App");
    });

    test("should delegate bootstrap_ai_rules to bootstrap handler", () => {
      const result = handleToolCall("bootstrap_ai_rules", {
        appDisplayName: "Rules App",
        appName: "rules-app",
      });
      expect(result.content[0].text).toContain("Bootstrap AI Rules for Rules App");
    });
  });
});
