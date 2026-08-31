import type {ObservabilityPlugin} from "../types";
import {registerObsPrompt} from "./models/obsPrompt";
import {registerObsPromptLabel} from "./models/obsPromptLabel";
import {registerObsPromptVersion} from "./models/obsPromptVersion";
import {registerObsScore} from "./models/obsScore";
import {registerObsSpan} from "./models/obsSpan";
import {registerObsTrace} from "./models/obsTrace";
import {LocalPromptStore} from "./promptStore";

export const registerLocalObservabilityModels = (): void => {
  registerObsPrompt();
  registerObsPromptVersion();
  registerObsPromptLabel();
  registerObsTrace();
  registerObsSpan();
  registerObsScore();
};

export const createLocalObservabilityPlugin = (): ObservabilityPlugin => {
  registerLocalObservabilityModels();
  const store = new LocalPromptStore();
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
  };
};
