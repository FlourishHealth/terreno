import type {ObservabilityPlugin} from "../types";
import {registerObsEvaluator} from "./models/obsEvaluator";
import {registerObsPrompt} from "./models/obsPrompt";
import {registerObsPromptLabel} from "./models/obsPromptLabel";
import {registerObsPromptVersion} from "./models/obsPromptVersion";
import {registerObsScore} from "./models/obsScore";
import {registerObsSpan} from "./models/obsSpan";
import {registerObsTrace} from "./models/obsTrace";
import {LocalPromptStore} from "./promptStore";
import {LocalScoreSink, LocalTraceSink, LocalTraceStore} from "./traceStore";

export const registerLocalObservabilityModels = (): void => {
  registerObsPrompt();
  registerObsPromptVersion();
  registerObsPromptLabel();
  registerObsTrace();
  registerObsSpan();
  registerObsScore();
  registerObsEvaluator();
};

export const createLocalObservabilityPlugin = (): ObservabilityPlugin => {
  registerLocalObservabilityModels();
  const store = new LocalPromptStore();
  const traces = new LocalTraceStore();
  return {
    capabilities: new Set([
      "datasets",
      "experiments",
      "prompts",
      "reviewQueue",
      "scores",
      "traces",
    ]),
    datasetStore: {},
    experimentRunner: {},
    id: "local",
    promptRegistry: store,
    reviewQueue: {},
    scoreSink: new LocalScoreSink(traces),
    traceSink: new LocalTraceSink(traces),
  };
};
