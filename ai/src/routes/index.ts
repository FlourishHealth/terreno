import type {ModelRouterOptions} from "@terreno/api";

import type {AIService} from "../service/aiService";
import {addAiRequestsExplorerRoutes} from "./aiRequestsExplorer";
import {addGptRoutes} from "./gpt";
import {addGptHistoryRoutes} from "./gptHistories";

export {addAiRequestsExplorerRoutes} from "./aiRequestsExplorer";
export {addGptRoutes} from "./gpt";
export {addGptHistoryRoutes} from "./gptHistories";

export interface AddAiRoutesOptions {
  aiService: AIService;
  openApiOptions?: Partial<ModelRouterOptions<any>>;
}

export const addAiRoutes = (router: any, options: AddAiRoutesOptions): void => {
  const {aiService, openApiOptions} = options;

  addGptHistoryRoutes(router, openApiOptions);
  addGptRoutes(router, {aiService, openApiOptions});
  addAiRequestsExplorerRoutes(router, {openApiOptions});
};
