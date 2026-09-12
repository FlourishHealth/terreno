import {createRequire} from "node:module";

import {DateTime} from "luxon";

import type {JobDocument} from "../modelTypes";
import type {JobRunner} from "../types";

export interface GcpTimestamp {
  nanos?: number;
  seconds: number;
}

export interface GcpHttpRequest {
  body?: string;
  headers?: Record<string, string>;
  httpMethod: "POST";
  oidcToken?: {
    audience?: string;
    serviceAccountEmail: string;
  };
  url: string;
}

export interface GcpTask {
  httpRequest?: GcpHttpRequest;
  scheduleTime?: GcpTimestamp;
}

export interface GcpCreateTaskRequest {
  parent: string;
  task: GcpTask;
}

export interface GcpCreateTaskResponse {
  name?: string;
}

/** Narrow Cloud Tasks client seam — inject in tests; production loads `@google-cloud/tasks`. */
export interface GcpCloudTasksClient {
  createTask(request: GcpCreateTaskRequest): Promise<[GcpCreateTaskResponse]>;
  queuePath(project: string, location: string, queue: string): string;
}

export interface GcpCloudTasksRunnerConfig {
  basePath?: string;
  /** Injected client for tests. Production wiring loads `@google-cloud/tasks`. */
  client?: GcpCloudTasksClient;
  location: string;
  oidcAudience?: string;
  project: string;
  publicUrl: string;
  queue: string;
  serviceAccountEmail: string;
}

interface ResolvedGcpCloudTasksRunnerConfig {
  basePath: string;
  location: string;
  oidcAudience?: string;
  project: string;
  publicUrl: string;
  queue: string;
  serviceAccountEmail: string;
}

const nodeRequire = createRequire(__filename);

const requireNonEmpty = (value: string | undefined, label: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`GcpCloudTasksRunner requires ${label}`);
  }
  return trimmed;
};

const normalizePublicUrl = (publicUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(publicUrl);
  } catch {
    throw new Error(
      `GcpCloudTasksRunner publicUrl must be an absolute http(s) URL, received: ${publicUrl}`
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`GcpCloudTasksRunner publicUrl must use http or https, received: ${publicUrl}`);
  }

  return parsed.toString().replace(/\/+$/, "");
};

const normalizeBasePath = (basePath: string | undefined): string => {
  const trimmed = (basePath ?? "/jobs").trim();
  if (!trimmed.startsWith("/")) {
    throw new Error(`GcpCloudTasksRunner basePath must start with "/", received: ${basePath}`);
  }
  return trimmed.replace(/\/+$/, "") || "/";
};

const resolveConfig = (config: GcpCloudTasksRunnerConfig): ResolvedGcpCloudTasksRunnerConfig => ({
  basePath: normalizeBasePath(config.basePath),
  location: requireNonEmpty(config.location, "location"),
  oidcAudience: config.oidcAudience?.trim() || undefined,
  project: requireNonEmpty(config.project, "project"),
  publicUrl: normalizePublicUrl(requireNonEmpty(config.publicUrl, "publicUrl")),
  queue: requireNonEmpty(config.queue, "queue"),
  serviceAccountEmail: requireNonEmpty(config.serviceAccountEmail, "serviceAccountEmail"),
});

const loadCloudTasksClient = (): (new () => GcpCloudTasksClient) => {
  try {
    const module = nodeRequire("@google-cloud/tasks") as {
      CloudTasksClient: new () => GcpCloudTasksClient;
    };
    return module.CloudTasksClient;
  } catch {
    throw new Error(
      "GcpCloudTasksRunner requires optional peer dependency @google-cloud/tasks. " +
        "Install it with: bun add @google-cloud/tasks"
    );
  }
};

const buildExecuteUrl = (publicUrl: string, basePath: string): string =>
  `${publicUrl}${basePath}/execute`;

const buildScheduleTime = (runAt: Date): GcpTimestamp | undefined => {
  const scheduled = DateTime.fromJSDate(runAt, {zone: "utc"});
  const now = DateTime.utc();
  if (scheduled <= now) {
    return undefined;
  }

  return {
    nanos: (scheduled.toMillis() % 1000) * 1_000_000,
    seconds: Math.floor(scheduled.toSeconds()),
  };
};

/**
 * Dispatch-only runner that enqueues Cloud Tasks HTTP POST callbacks to
 * `{publicUrl}{basePath}/execute` with an OIDC token.
 */
export class GcpCloudTasksRunner implements JobRunner {
  readonly id = "gcp-cloud-tasks";
  readonly requiresExecuteRoute = true;

  private readonly client: GcpCloudTasksClient;
  private readonly config: ResolvedGcpCloudTasksRunnerConfig;

  constructor(config: GcpCloudTasksRunnerConfig) {
    this.config = resolveConfig(config);
    this.client = config.client ?? new (loadCloudTasksClient())();
  }

  async enqueue(job: JobDocument): Promise<void> {
    const executeUrl = buildExecuteUrl(this.config.publicUrl, this.config.basePath);
    const body = Buffer.from(JSON.stringify({jobId: job._id.toString()})).toString("base64");
    const task: GcpTask = {
      httpRequest: {
        body,
        headers: {
          "Content-Type": "application/json",
        },
        httpMethod: "POST",
        oidcToken: {
          audience: this.config.oidcAudience ?? executeUrl,
          serviceAccountEmail: this.config.serviceAccountEmail,
        },
        url: executeUrl,
      },
    };

    const scheduleTime = buildScheduleTime(job.runAt);
    if (scheduleTime) {
      task.scheduleTime = scheduleTime;
    }

    const parent = this.client.queuePath(
      this.config.project,
      this.config.location,
      this.config.queue
    );

    await this.client.createTask({parent, task});
  }
}
