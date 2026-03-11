import {APIError, asyncHandler, authenticateMiddleware} from "@terreno/api";
import type express from "express";

import {compilePrompt, getPrompt} from "../prompts";
import type {ChatMessage} from "../types";
import {requireAdmin} from "./middleware";

export const addPlaygroundRoutes = (router: express.Application, basePath: string): void => {
  router.post(
    `${basePath}/playground`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      const {promptName, variables, label} = req.body as {
        promptName: string;
        variables?: Record<string, string>;
        label?: string;
      };

      if (!promptName) {
        throw new APIError({
          detail: "promptName is required",
          status: 400,
          title: "Invalid request",
        });
      }

      const cached = await getPrompt(promptName, {label, variables});
      const compiled = compilePrompt(cached, variables ?? {});

      return res.json({
        compiled,
        config: cached.config,
        labels: cached.labels,
        name: cached.name,
        type: cached.type,
        variables: extractVariables(
          cached.type === "text"
            ? (cached.prompt as string)
            : (cached.prompt as ChatMessage[]).map((m) => m.content).join(" ")
        ),
        version: cached.version,
      });
    })
  );
};

const extractVariables = (template: string): string[] => {
  const matches = template.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
};
