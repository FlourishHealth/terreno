import {APIError} from "../errors";
import type {AuditEnqueue, AuditEventWrite} from "./record";

interface CloudTasksClient {
  createTask: (request: {
    parent: string;
    task: {
      httpRequest: {
        body: string;
        headers: Record<string, string>;
        httpMethod: "POST";
        url: string;
      };
    };
  }) => Promise<unknown>;
}

interface CloudTasksModule {
  CloudTasksClient?: new () => CloudTasksClient;
  default?: {CloudTasksClient?: new () => CloudTasksClient};
}

export interface CloudTasksAuditEnqueueOptions {
  location: string;
  project: string;
  queue: string;
  secret: string;
  url: string;
  loadModule?: () => Promise<CloudTasksModule>;
}

const AUDIT_SECRET_HEADER = "X-Terreno-Audit-Secret";

export const createCloudTasksAuditEnqueue = (
  options: CloudTasksAuditEnqueueOptions
): AuditEnqueue => {
  let client: CloudTasksClient | undefined;
  const loadModule =
    options.loadModule ??
    (() => {
      const moduleName = "@google-cloud/tasks";
      return import(/* webpackIgnore: true */ moduleName);
    });

  const getClient = async (): Promise<CloudTasksClient> => {
    if (client) {
      return client;
    }
    let mod: CloudTasksModule;
    try {
      mod = await loadModule();
    } catch {
      throw new APIError({
        status: 500,
        title:
          "Cloud Tasks audit enqueue requires @google-cloud/tasks. Install it with: bun add @google-cloud/tasks",
      });
    }
    const Client = mod.CloudTasksClient ?? mod.default?.CloudTasksClient;
    if (!Client) {
      throw new APIError({
        status: 500,
        title: "CloudTasksClient not found in @google-cloud/tasks module",
      });
    }
    client = new Client();
    return client;
  };

  return async (write: AuditEventWrite): Promise<void> => {
    const tasks = await getClient();
    const parent = `projects/${options.project}/locations/${options.location}/queues/${options.queue}`;
    await tasks.createTask({
      parent,
      task: {
        httpRequest: {
          body: Buffer.from(JSON.stringify(write), "utf8").toString("base64"),
          headers: {
            "Content-Type": "application/json",
            [AUDIT_SECRET_HEADER]: options.secret,
          },
          httpMethod: "POST",
          url: options.url,
        },
      },
    });
  };
};

export const auditEnqueueFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): AuditEnqueue | undefined => {
  const queue = env.GCP_TASKS_AUDIT_QUEUE;
  const url = env.AUDIT_TASKS_URL;
  const project = env.GCP_PROJECT;
  const location = env.GCP_LOCATION;
  const secret = env.AUDIT_TASKS_SECRET;
  if (!queue || !url || !project || !location || !secret) {
    return undefined;
  }
  return createCloudTasksAuditEnqueue({location, project, queue, secret, url});
};

export {AUDIT_SECRET_HEADER};
