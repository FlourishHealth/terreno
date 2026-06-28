import {afterAll, beforeAll, describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {
  BackgroundTask,
  createScriptArgs,
  parseScriptArgs,
  type ScriptArgDef,
  TaskCancelledError,
} from "./scriptRunner";

describe("parseScriptArgs", () => {
  it("parses --name=value form", () => {
    const {args} = parseScriptArgs(["--model=todos"]);
    expect(args.getString("model")).toBe("todos");
    expect(args.has("model")).toBe(true);
  });

  it("parses --name value form", () => {
    const {args} = parseScriptArgs(["--model", "todos"]);
    expect(args.getString("model")).toBe("todos");
  });

  it("treats a lone --flag as boolean true", () => {
    const {args} = parseScriptArgs(["--wet"]);
    expect(args.getBoolean("wet")).toBe(true);
  });

  it("parses --no-flag as boolean false", () => {
    const {args} = parseScriptArgs(["--no-cache"]);
    expect(args.getBoolean("cache")).toBe(false);
  });

  it("treats short -x like --x", () => {
    const {args} = parseScriptArgs(["-v"]);
    expect(args.getBoolean("v")).toBe(true);
  });

  it("collects positional arguments", () => {
    const {args} = parseScriptArgs(["one", "two", "-"]);
    expect(args.positional).toEqual(["one", "two", "-"]);
  });

  it("collapses repeated flags into an array", () => {
    const {args} = parseScriptArgs(["--tag", "a", "--tag", "b", "--tag=c"]);
    expect(args.getStringArray("tag")).toEqual(["a", "b", "c"]);
  });

  it("does not consume the next token for declared boolean flags", () => {
    const defs: ScriptArgDef[] = [{description: "verbose", name: "verbose", type: "boolean"}];
    const {args} = parseScriptArgs(["--verbose", "leftover"], defs);
    expect(args.getBoolean("verbose")).toBe(true);
    expect(args.positional).toEqual(["leftover"]);
  });

  it("resolves aliases to the canonical name", () => {
    const defs: ScriptArgDef[] = [
      {aliases: ["m"], description: "model", name: "model", type: "string"},
    ];
    const {args} = parseScriptArgs(["-m", "users"], defs);
    expect(args.getString("model")).toBe("users");
  });

  it("treats a trailing flag with no value as boolean true", () => {
    const {args} = parseScriptArgs(["--model", "todos", "--wet"]);
    expect(args.getString("model")).toBe("todos");
    expect(args.getBoolean("wet")).toBe(true);
  });

  it("errors when a declared string flag is missing its value", () => {
    const defs: ScriptArgDef[] = [{description: "model", name: "model", type: "string"}];
    const {errors} = parseScriptArgs(["--model"], defs);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toInclude("--model expects a string value");
  });

  it("errors when a declared number flag is followed by another flag", () => {
    const defs: ScriptArgDef[] = [{description: "limit", name: "limit", type: "number"}];
    const {errors} = parseScriptArgs(["--limit", "--wet"], defs);
    expect(errors.some((e) => e.includes("--limit expects a number value"))).toBe(true);
  });

  it("still treats an undeclared value-less flag as boolean true", () => {
    const {args, errors} = parseScriptArgs(["--unknown"]);
    expect(errors).toHaveLength(0);
    expect(args.getBoolean("unknown")).toBe(true);
  });
});

describe("createScriptArgs", () => {
  it("applies declared defaults when missing", () => {
    const defs: ScriptArgDef[] = [{default: "all", description: "model", name: "model"}];
    const {args, errors} = createScriptArgs({defs, values: {}});
    expect(errors).toHaveLength(0);
    expect(args.getString("model")).toBe("all");
  });

  it("reports an error for missing required args", () => {
    const defs: ScriptArgDef[] = [{description: "model", name: "model", required: true}];
    const {errors} = createScriptArgs({defs, values: {}});
    expect(errors).toHaveLength(1);
    expect(errors[0]).toInclude("Missing required argument: --model");
  });

  it("coerces declared number args and reports invalid numbers", () => {
    const defs: ScriptArgDef[] = [{description: "limit", name: "limit", type: "number"}];
    const ok = createScriptArgs({defs, values: {limit: "10"}});
    expect(ok.errors).toHaveLength(0);
    expect(ok.args.getNumber("limit")).toBe(10);

    const bad = createScriptArgs({defs, values: {limit: "nope"}});
    expect(bad.errors).toHaveLength(1);
    expect(bad.errors[0]).toInclude("expected a number");
  });

  it("coerces declared boolean args", () => {
    const defs: ScriptArgDef[] = [{description: "force", name: "force", type: "boolean"}];
    expect(createScriptArgs({defs, values: {force: "yes"}}).args.getBoolean("force")).toBe(true);
    expect(createScriptArgs({defs, values: {force: "off"}}).args.getBoolean("force")).toBe(false);
    const bad = createScriptArgs({defs, values: {force: "maybe"}});
    expect(bad.errors[0]).toInclude("expected a boolean");
  });

  it("coerces booleans and numbers from array values (first element)", () => {
    const defs: ScriptArgDef[] = [
      {description: "force", name: "force", type: "boolean"},
      {description: "limit", name: "limit", type: "number"},
    ];
    const {args} = createScriptArgs({
      defs,
      values: {force: ["true", "false"], limit: ["5", "6"]},
    });
    expect(args.getBoolean("force")).toBe(true);
    expect(args.getNumber("limit")).toBe(5);
  });

  describe("getters", () => {
    it("getString returns fallback when missing and stringifies non-strings", () => {
      const {args} = createScriptArgs({values: {count: 3, flag: true}});
      expect(args.getString("missing", "fallback")).toBe("fallback");
      expect(args.getString("count")).toBe("3");
      expect(args.getString("flag")).toBe("true");
    });

    it("getNumber handles native numbers, strings, NaN, and missing", () => {
      const {args} = createScriptArgs({values: {a: 7, b: "8", c: "x"}});
      expect(args.getNumber("a")).toBe(7);
      expect(args.getNumber("b")).toBe(8);
      expect(args.getNumber("c", 1)).toBe(1);
      expect(args.getNumber("missing", 99)).toBe(99);
      expect(args.getNumber("missing")).toBeUndefined();
    });

    it("getBoolean honors native booleans, string truthiness, and fallback", () => {
      const {args} = createScriptArgs({values: {a: true, b: "on", c: "nope"}});
      expect(args.getBoolean("a")).toBe(true);
      expect(args.getBoolean("b")).toBe(true);
      expect(args.getBoolean("c")).toBe(false);
      expect(args.getBoolean("missing")).toBe(false);
      expect(args.getBoolean("missing", true)).toBe(true);
    });

    it("reads undeclared array values via getString/getNumber (first element)", () => {
      const {args} = createScriptArgs({values: {nums: ["3", "4"], tags: ["x", "y"]}});
      expect(args.getString("tags")).toBe("x");
      expect(args.getNumber("nums")).toBe(3);
    });

    it("getStringArray normalizes single values and missing keys", () => {
      const {args} = createScriptArgs({values: {many: ["a", "b"], one: "x"}});
      expect(args.getStringArray("one")).toEqual(["x"]);
      expect(args.getStringArray("many")).toEqual(["a", "b"]);
      expect(args.getStringArray("missing")).toEqual([]);
    });

    it("exposes raw values and positional list", () => {
      const {args} = createScriptArgs({positional: ["p"], values: {x: "1"}});
      expect(args.raw.x).toBe("1");
      expect(args.positional).toEqual(["p"]);
    });
  });
});

describe("TaskCancelledError", () => {
  it("sets the message and name", () => {
    const err = new TaskCancelledError("task-123");
    expect(err.message).toBe("Task task-123 was cancelled");
    expect(err.name).toBe("TaskCancelledError");
  });

  it("is an instance of Error", () => {
    const err = new TaskCancelledError("abc");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("BackgroundTask model", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URL ?? "mongodb://127.0.0.1/terreno-test");
    }
    await BackgroundTask.deleteMany({});
  });

  afterAll(async () => {
    await BackgroundTask.deleteMany({});
  });

  it("creates a task with required fields", async () => {
    const task = await BackgroundTask.create({taskType: "test-task"});
    expect(task.taskType).toBe("test-task");
    expect(task.status).toBe("pending");
    expect(task.isDryRun).toBe(false);
    expect(task.logs).toEqual([]);
  });

  describe("addLog", () => {
    it("appends a log entry and saves", async () => {
      const task = await BackgroundTask.create({taskType: "log-test"});
      await task.addLog("info", "step completed");

      const reloaded = await BackgroundTask.findById(task._id);
      expect(reloaded?.logs).toHaveLength(1);
      expect(reloaded?.logs[0].level).toBe("info");
      expect(reloaded?.logs[0].message).toBe("step completed");
      expect(reloaded?.logs[0].timestamp).toBeDefined();
    });

    it("appends multiple log entries", async () => {
      const task = await BackgroundTask.create({taskType: "multi-log"});
      await task.addLog("info", "first");
      await task.addLog("warn", "second");
      await task.addLog("error", "third");

      const reloaded = await BackgroundTask.findById(task._id);
      expect(reloaded?.logs).toHaveLength(3);
      expect(reloaded?.logs[0].level).toBe("info");
      expect(reloaded?.logs[1].level).toBe("warn");
      expect(reloaded?.logs[2].level).toBe("error");
    });
  });

  describe("updateProgress", () => {
    it("sets progress percentage and stage", async () => {
      const task = await BackgroundTask.create({taskType: "progress-test"});
      await task.updateProgress(50, "processing", "halfway done");

      const reloaded = await BackgroundTask.findById(task._id);
      expect(reloaded?.progress?.percentage).toBe(50);
      expect(reloaded?.progress?.stage).toBe("processing");
      expect(reloaded?.progress?.message).toBe("halfway done");
    });

    it("preserves previous stage and message when not provided", async () => {
      const task = await BackgroundTask.create({taskType: "progress-retain"});
      await task.updateProgress(25, "init", "starting");
      await task.updateProgress(75);

      const reloaded = await BackgroundTask.findById(task._id);
      expect(reloaded?.progress?.percentage).toBe(75);
      expect(reloaded?.progress?.stage).toBe("init");
      expect(reloaded?.progress?.message).toBe("starting");
    });
  });

  describe("checkCancellation", () => {
    it("does nothing when task is not cancelled", async () => {
      const task = await BackgroundTask.create({status: "running", taskType: "check-cancel"});
      await expect(BackgroundTask.checkCancellation(task._id.toString())).resolves.toBeUndefined();
    });

    it("throws TaskCancelledError when task is cancelled", async () => {
      const task = await BackgroundTask.create({status: "cancelled", taskType: "check-cancel"});
      await expect(BackgroundTask.checkCancellation(task._id.toString())).rejects.toThrow(
        TaskCancelledError
      );
    });

    it("does nothing when task does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(BackgroundTask.checkCancellation(fakeId)).resolves.toBeUndefined();
    });
  });
});
