import {type ConfigurationModel, configurationPlugin, createdUpdatedPlugin} from "@terreno/api";
import mongoose, {Schema} from "mongoose";

/**
 * Example configuration model demonstrating the Terreno configuration system.
 *
 * Each top-level subschema becomes a section in the admin configuration UI.
 * Fields marked with `secret: true` can be resolved from a SecretProvider.
 */

const generalSchema = new Schema(
  {
    appName: {
      default: "Terreno Example",
      description: "Display name of the application",
      type: String,
    },
    maintenanceMode: {
      default: false,
      description: "When enabled, the app returns 503 for all non-admin requests",
      type: Boolean,
    },
    maxUploadSizeMb: {
      default: 10,
      description: "Maximum file upload size in megabytes",
      type: Number,
    },
  },
  {_id: false}
);

const integrationsSchema = new Schema(
  {
    openAiApiKey: {
      default: "",
      description: "OpenAI API key for AI features",
      secret: true,
      secretName: "openai-api-key",
      type: String,
    },
    openAiModel: {
      default: "gpt-4",
      description: "Default OpenAI model to use",
      type: String,
    },
    sendgridApiKey: {
      default: "",
      description: "SendGrid API key for sending emails",
      secret: true,
      secretName: "sendgrid-api-key",
      type: String,
    },
    sendgridFromEmail: {
      default: "noreply@example.com",
      description: "Default sender email address for outgoing emails",
      type: String,
    },
  },
  {_id: false}
);

const notificationsSchema = new Schema(
  {
    emailNotificationsEnabled: {
      default: true,
      description: "Whether to send email notifications to users",
      type: Boolean,
    },
    slackWebhookUrl: {
      default: "",
      description: "Slack webhook URL for admin notifications",
      secret: true,
      secretName: "slack-webhook-url",
      type: String,
    },
  },
  {_id: false}
);

const debugSchema = new Schema(
  {
    websocketsDebug: {
      default: false,
      description: "Enable verbose WebSocket and realtime sync debug logging",
      type: Boolean,
    },
  },
  {_id: false}
);

const vertexModelCatalogEntrySchema = new Schema(
  {
    id: {
      description: "Vertex model id (e.g. gemini-3.5-flash, claude-sonnet-4-6)",
      required: true,
      type: String,
    },
    label: {
      description: "Display label in the chat model picker",
      required: true,
      type: String,
    },
    provider: {
      description: "Model provider on Vertex",
      enum: ["gemini", "anthropic", "maas"],
      required: true,
      type: String,
    },
  },
  {_id: false}
);

const vertexAiSchema = new Schema(
  {
    additionalCatalog: {
      default: [],
      description: "Extra models merged into the Vertex catalog (admin-managed)",
      type: [vertexModelCatalogEntrySchema],
    },
    allowUnknownAnthropicModels: {
      default: false,
      description: "Allow Claude-shaped model ids not listed in the catalog",
      type: Boolean,
    },
    allowUnknownGeminiModels: {
      default: true,
      description: "Allow Gemini-shaped model ids not listed in the catalog",
      type: Boolean,
    },
    allowUnknownMaasModels: {
      default: false,
      description: "Allow MaaS-shaped model ids not listed in the catalog",
      type: Boolean,
    },
    anthropicLocation: {
      default: "us-east5",
      description: "Google Cloud region for Vertex Anthropic models",
      type: String,
    },
    catalogMode: {
      default: "extend",
      description: "How additionalCatalog combines with defaults (extend or replace)",
      enum: ["extend", "replace"],
      type: String,
    },
    defaultModelId: {
      default: "gemini-3.5-flash",
      description: "Default chat model id for new conversations",
      type: String,
    },
    enableAnthropicModels: {
      default: false,
      description: "Expose Anthropic (Claude) models from the Vertex catalog",
      type: Boolean,
    },
    enabled: {
      default: false,
      description: "Use Vertex AI for server-side chat (requires project id and ADC)",
      type: Boolean,
    },
    enableMaasModels: {
      default: false,
      description: "Expose MaaS (open-weight) models from the Vertex catalog",
      type: Boolean,
    },
    geminiApiKey: {
      default: "",
      description: "Gemini API key fallback when Vertex is disabled or unavailable",
      secret: true,
      secretName: "gemini-api-key",
      type: String,
    },
    includeDefaultCatalog: {
      default: true,
      description: "When catalog mode is replace, also include the built-in default catalog",
      type: Boolean,
    },
    location: {
      default: "us-central1",
      description: "Google Cloud region for Vertex Gemini and MaaS models",
      type: String,
    },
    projectId: {
      default: "",
      description: "Google Cloud project id for Vertex AI",
      type: String,
    },
    titleModelId: {
      default: "gemini-3.1-flash-lite",
      description: "Model id used to auto-generate conversation titles",
      type: String,
    },
  },
  {_id: false}
);

export interface AppConfigDocument {
  general: {
    appName: string;
    maintenanceMode: boolean;
    maxUploadSizeMb: number;
  };
  integrations: {
    openAiApiKey: string;
    openAiModel: string;
    sendgridApiKey: string;
    sendgridFromEmail: string;
  };
  notifications: {
    emailNotificationsEnabled: boolean;
    slackWebhookUrl: string;
  };
  debug: {
    websocketsDebug: boolean;
  };
  vertexAi: {
    additionalCatalog: Array<{
      id: string;
      label: string;
      provider: "gemini" | "anthropic" | "maas";
    }>;
    allowUnknownAnthropicModels: boolean;
    allowUnknownGeminiModels: boolean;
    allowUnknownMaasModels: boolean;
    anthropicLocation: string;
    catalogMode: "extend" | "replace";
    defaultModelId: string;
    enableAnthropicModels: boolean;
    enableMaasModels: boolean;
    enabled: boolean;
    geminiApiKey: string;
    includeDefaultCatalog: boolean;
    location: string;
    projectId: string;
    titleModelId: string;
  };
}

const appConfigSchema = new Schema<AppConfigDocument>(
  {
    debug: {
      description: "Debug and diagnostic settings",
      type: debugSchema,
    },
    general: {
      description: "General application settings",
      type: generalSchema,
    },
    integrations: {
      description: "Third-party service integrations",
      type: integrationsSchema,
    },
    notifications: {
      description: "Notification preferences and channels",
      type: notificationsSchema,
    },
    vertexAi: {
      description: "Vertex AI model catalog, defaults, and provider settings",
      type: vertexAiSchema,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

appConfigSchema.plugin(configurationPlugin);
appConfigSchema.plugin(createdUpdatedPlugin);

appConfigSchema.post("save", () => {
  void import("../vertexModelConfig").then((module) =>
    module.configureExampleVertexModelsFromAdmin()
  );
});

export const AppConfiguration = mongoose.model<AppConfigDocument>(
  "AppConfiguration",
  appConfigSchema
) as ConfigurationModel<AppConfigDocument>;
