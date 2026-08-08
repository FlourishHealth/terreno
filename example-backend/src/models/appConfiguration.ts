import {
  CachingSecretProvider,
  CompositeSecretProvider,
  type ConfigurationModel,
  configurationPlugin,
  createdUpdatedPlugin,
  EnvSecretProvider,
} from "@terreno/api";
import mongoose, {Schema} from "mongoose";

/**
 * Example configuration model demonstrating the Terreno configuration system.
 *
 * Each top-level subschema becomes a section in the admin configuration UI.
 * Fields marked with `secret: true` are resolved on-demand from a
 * SecretProvider (never persisted to the document).
 *
 * The provider below composes sources (here just env vars, but production apps
 * typically prepend a `GcpSecretProvider`) and wraps them in a short-TTL cache:
 *   new CachingSecretProvider(new CompositeSecretProvider([gcp, env]), {ttlMs})
 */
const secretProvider = new CachingSecretProvider(
  new CompositeSecretProvider([new EnvSecretProvider()]),
  {ttlMs: 60_000}
);

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
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

appConfigSchema.plugin(configurationPlugin, {secretProvider});
appConfigSchema.plugin(createdUpdatedPlugin);

export const AppConfiguration = mongoose.model<AppConfigDocument>(
  "AppConfiguration",
  appConfigSchema
) as ConfigurationModel<AppConfigDocument>;
