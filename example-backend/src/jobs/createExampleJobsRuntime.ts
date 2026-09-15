import {type JobRunner, type JobsAppOptions, MongoJobRunner} from "@terreno/jobs";
import {type GcpCloudTasksClient, GcpCloudTasksRunner} from "@terreno/jobs/runners/gcpCloudTasks";
import type {Request} from "express";
import {OAuth2Client} from "google-auth-library";

const GCP_CLOUD_TASKS_RUNNER = "gcp-cloud-tasks";
const MONGO_RUNNER = "mongo";

export interface IdTokenPayload {
  email?: string;
  email_verified?: boolean;
}

export interface IdTokenTicket {
  getPayload: () => IdTokenPayload | undefined;
}

export interface IdTokenVerifier {
  verifyIdToken: (options: {audience: string; idToken: string}) => Promise<IdTokenTicket>;
}

export interface CreateExampleJobsRuntimeOptions {
  cloudTasksClient?: GcpCloudTasksClient;
  environment?: NodeJS.ProcessEnv;
  idTokenVerifier?: IdTokenVerifier;
}

export interface ExampleJobsRuntime {
  executeAuth?: NonNullable<JobsAppOptions["executeAuth"]>;
  runner: JobRunner;
}

const requireEnvironmentValue = (environment: NodeJS.ProcessEnv, name: string): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when JOBS_RUNNER=${GCP_CLOUD_TASKS_RUNNER}`);
  }
  return value;
};

const readBearerToken = (request: Request): string | undefined => {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
};

const createExecuteAuth = ({
  audience,
  expectedEmail,
  verifier,
}: {
  audience: string;
  expectedEmail: string;
  verifier: IdTokenVerifier;
}): NonNullable<JobsAppOptions["executeAuth"]> => {
  return async (request): Promise<boolean> => {
    const idToken = readBearerToken(request);
    if (!idToken) {
      return false;
    }

    const ticket = await verifier.verifyIdToken({audience, idToken});
    const payload = ticket.getPayload();
    return payload?.email_verified === true && payload.email === expectedEmail;
  };
};

export const createExampleJobsRuntime = (
  options: CreateExampleJobsRuntimeOptions = {}
): ExampleJobsRuntime => {
  const environment = options.environment ?? process.env;
  const runnerName = environment.JOBS_RUNNER?.trim() || MONGO_RUNNER;
  if (runnerName === MONGO_RUNNER) {
    return {runner: new MongoJobRunner()};
  }
  if (runnerName !== GCP_CLOUD_TASKS_RUNNER) {
    throw new Error(`Unsupported JOBS_RUNNER: ${runnerName}`);
  }

  const project = requireEnvironmentValue(environment, "GCP_TASKS_PROJECT");
  const location = requireEnvironmentValue(environment, "GCP_TASKS_LOCATION");
  const queue = requireEnvironmentValue(environment, "GCP_TASKS_QUEUE");
  const publicUrl = requireEnvironmentValue(environment, "GCP_TASKS_PUBLIC_URL");
  const serviceAccountEmail = requireEnvironmentValue(
    environment,
    "GCP_TASKS_SERVICE_ACCOUNT_EMAIL"
  );
  const oidcAudience =
    environment.GCP_TASKS_OIDC_AUDIENCE?.trim() || `${publicUrl.replace(/\/+$/, "")}/jobs/execute`;
  const verifier = options.idTokenVerifier ?? new OAuth2Client();

  return {
    executeAuth: createExecuteAuth({
      audience: oidcAudience,
      expectedEmail: serviceAccountEmail,
      verifier,
    }),
    runner: new GcpCloudTasksRunner({
      client: options.cloudTasksClient,
      location,
      oidcAudience,
      project,
      publicUrl,
      queue,
      serviceAccountEmail,
    }),
  };
};
