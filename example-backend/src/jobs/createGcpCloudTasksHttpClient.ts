import type {
  GcpCloudTasksClient,
  GcpCreateTaskRequest,
  GcpCreateTaskResponse,
  GcpTimestamp,
} from "@terreno/jobs/runners/gcpCloudTasks";
import {GoogleAuth} from "google-auth-library";
import {DateTime} from "luxon";

interface GcpTasksHttpRequest {
  data: {task: unknown};
  method: "POST";
  url: string;
}

interface GcpTasksTokenClient {
  request: (options: GcpTasksHttpRequest) => Promise<{data?: GcpCreateTaskResponse}>;
}

export interface GcpTasksAuth {
  getClient: () => Promise<GcpTasksTokenClient>;
}

const CLOUD_TASKS_SCOPE = "https://www.googleapis.com/auth/cloud-tasks";

const toRfc3339 = (timestamp: GcpTimestamp | undefined): string | undefined => {
  if (!timestamp) {
    return undefined;
  }

  return (
    DateTime.fromSeconds(timestamp.seconds, {zone: "utc"})
      .plus({milliseconds: Math.floor((timestamp.nanos ?? 0) / 1_000_000)})
      .toUTC()
      .toISO() ?? undefined
  );
};

const defaultAuth = (): GcpTasksAuth => {
  const auth = new GoogleAuth({scopes: [CLOUD_TASKS_SCOPE]});
  return {
    getClient: async (): Promise<GcpTasksTokenClient> => {
      const tokenClient = await auth.getClient();
      return {
        request: async (options: GcpTasksHttpRequest): Promise<{data?: GcpCreateTaskResponse}> => {
          const response = await tokenClient.request<GcpCreateTaskResponse>({
            data: options.data,
            method: options.method,
            url: options.url,
          });
          return {data: response.data};
        },
      };
    },
  };
};

export const createGcpCloudTasksHttpClient = (
  auth: GcpTasksAuth = defaultAuth()
): GcpCloudTasksClient => {
  return {
    createTask: async (request: GcpCreateTaskRequest): Promise<[GcpCreateTaskResponse]> => {
      const client = await auth.getClient();
      const scheduleTime = toRfc3339(request.task.scheduleTime);
      const response = await client.request({
        data: {
          task: {
            httpRequest: request.task.httpRequest,
            ...(scheduleTime ? {scheduleTime} : {}),
          },
        },
        method: "POST",
        url: `https://cloudtasks.googleapis.com/v2/${request.parent}/tasks`,
      });
      return [{name: response.data?.name}];
    },
    queuePath: (project: string, location: string, queue: string): string =>
      `projects/${project}/locations/${location}/queues/${queue}`,
  };
};
