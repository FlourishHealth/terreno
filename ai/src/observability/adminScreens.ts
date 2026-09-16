import type {AdminCustomScreen} from "@terreno/api";

export const AI_OBSERVABILITY_GROUP = "AI Observability";

export const observabilityAdminScreens = ({localOn}: {localOn: boolean}): AdminCustomScreen[] => {
  const screens: AdminCustomScreen[] = [
    {displayName: "Prompts", group: AI_OBSERVABILITY_GROUP, name: "ai-prompts"},
    {displayName: "Traces", group: AI_OBSERVABILITY_GROUP, name: "ai-traces"},
    {displayName: "Evaluators", group: AI_OBSERVABILITY_GROUP, name: "ai-evaluators"},
    {displayName: "Datasets", group: AI_OBSERVABILITY_GROUP, name: "ai-datasets"},
    {displayName: "Experiments", group: AI_OBSERVABILITY_GROUP, name: "ai-experiments"},
  ];
  if (localOn) {
    screens.push({displayName: "Review queue", group: AI_OBSERVABILITY_GROUP, name: "ai-review"});
  }
  return screens;
};
