import {describe, it} from "bun:test";
import {assert} from "chai";

import {getJobsService, Job, JobSchedule, JobsApp, MongoJobRunner} from "../index";

describe("package public exports", () => {
  it("re-exports JobsApp, models, MongoJobRunner, and getJobsService", (): void => {
    assert.equal(JobsApp.name, "JobsApp");
    assert.equal(MongoJobRunner.name, "MongoJobRunner");
    assert.equal(Job.modelName, "Job");
    assert.equal(JobSchedule.modelName, "JobSchedule");
    assert.equal(typeof getJobsService, "function");
  });
});
