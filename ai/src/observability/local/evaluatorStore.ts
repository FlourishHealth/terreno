import {APIError} from "@terreno/api";

import type {
  EvaluatorDimension,
  EvaluatorRunModes,
  ObsEvaluatorDocument,
} from "../../types/observability";
import {getEvaluatorTemplate} from "../evaluatorTemplates";
import {registerObsEvaluator} from "./models/obsEvaluator";

export interface EvaluatorWriteInput {
  assertion?: {constraint: string; path: string};
  confidenceAlertBelow?: number;
  description?: string;
  dimensions: EvaluatorDimension[];
  instructions?: string;
  judgePromptName?: string;
  name: string;
  runModes?: Partial<EvaluatorRunModes>;
  target: "dataset item" | "full trace" | "generation span";
  type: "human" | "json-assert" | "llm-judge";
}

export interface EvaluatorView {
  assertion?: {constraint: string; path: string};
  confidenceAlertBelow: number;
  description?: string;
  dimensions: EvaluatorDimension[];
  id: string;
  instructions?: string;
  judgePromptName?: string;
  name: string;
  runModes: EvaluatorRunModes;
  target: "dataset item" | "full trace" | "generation span";
  type: "human" | "json-assert" | "llm-judge";
}

const defaultRunModes = (partial?: Partial<EvaluatorRunModes>): EvaluatorRunModes => {
  return {
    allowManualRun: partial?.allowManualRun ?? true,
    availableInExperiments: partial?.availableInExperiments ?? true,
    liveSampleRate: partial?.liveSampleRate ?? 0,
  };
};

const rejectHumanLiveSampling = (type: string, liveSampleRate: number): void => {
  if (type === "human" && liveSampleRate > 0) {
    throw new APIError({
      status: 400,
      title: "human evaluators cannot set liveSampleRate above 0",
    });
  }
};

const toView = (doc: ObsEvaluatorDocument): EvaluatorView => {
  return {
    assertion: doc.assertion,
    confidenceAlertBelow: doc.confidenceAlertBelow,
    description: doc.description,
    dimensions: doc.dimensions,
    id: String(doc._id),
    instructions: doc.instructions,
    judgePromptName: doc.judgePromptName,
    name: doc.name,
    runModes: doc.runModes,
    target: doc.target,
    type: doc.type,
  };
};

export class LocalEvaluatorStore {
  async create(input: EvaluatorWriteInput): Promise<EvaluatorView> {
    if (input.type !== "human") {
      throw new APIError({status: 400, title: "phase 1 only supports human evaluators"});
    }
    const runModes = defaultRunModes(input.runModes);
    rejectHumanLiveSampling(input.type, runModes.liveSampleRate);
    if (!input.name || input.dimensions.length === 0) {
      throw new APIError({status: 400, title: "name and dimensions are required"});
    }
    try {
      const created = await registerObsEvaluator().create({
        assertion: input.assertion,
        confidenceAlertBelow: input.confidenceAlertBelow ?? 0.7,
        description: input.description,
        dimensions: input.dimensions,
        instructions: input.instructions,
        judgePromptName: input.judgePromptName,
        name: input.name,
        runModes,
        target: input.target,
        type: input.type,
      });
      return toView(created);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as {code?: number}).code === 11000
      ) {
        throw new APIError({status: 409, title: `Evaluator "${input.name}" already exists`});
      }
      throw error;
    }
  }

  async list(): Promise<EvaluatorView[]> {
    const rows = await registerObsEvaluator().find({}).sort({name: 1});
    return rows.map((row) => {
      return toView(row);
    });
  }

  async get(id: string): Promise<EvaluatorView> {
    const doc = await registerObsEvaluator().findOneOrNone({_id: id});
    if (!doc) {
      throw new APIError({status: 404, title: `Unknown evaluator "${id}"`});
    }
    return toView(doc);
  }

  async update(id: string, input: Partial<EvaluatorWriteInput>): Promise<EvaluatorView> {
    const doc = await registerObsEvaluator().findOneOrNone({_id: id});
    if (!doc) {
      throw new APIError({status: 404, title: `Unknown evaluator "${id}"`});
    }
    const type = input.type ?? doc.type;
    const runModes = defaultRunModes({...doc.runModes, ...input.runModes});
    rejectHumanLiveSampling(type, runModes.liveSampleRate);
    if (input.type && input.type !== "human") {
      throw new APIError({status: 400, title: "phase 1 only supports human evaluators"});
    }
    doc.assertion = input.assertion ?? doc.assertion;
    doc.confidenceAlertBelow = input.confidenceAlertBelow ?? doc.confidenceAlertBelow;
    doc.description = input.description ?? doc.description;
    doc.dimensions = input.dimensions ?? doc.dimensions;
    doc.instructions = input.instructions ?? doc.instructions;
    doc.judgePromptName = input.judgePromptName ?? doc.judgePromptName;
    doc.name = input.name ?? doc.name;
    doc.runModes = runModes;
    doc.target = input.target ?? doc.target;
    await doc.save();
    return toView(doc);
  }

  async remove(id: string): Promise<void> {
    const doc = await registerObsEvaluator().findOneOrNone({_id: id});
    if (!doc) {
      throw new APIError({status: 404, title: `Unknown evaluator "${id}"`});
    }
    doc.deleted = true;
    await doc.save();
  }

  async installTemplate(name: string): Promise<EvaluatorView> {
    const template = getEvaluatorTemplate(name);
    if (!template) {
      throw new APIError({status: 404, title: `Unknown evaluator template "${name}"`});
    }
    return this.create({
      description: template.description,
      dimensions: template.dimensions,
      instructions: template.instructions,
      name: template.name,
      runModes: template.runModes,
      target: template.target,
      type: template.type,
    });
  }
}
