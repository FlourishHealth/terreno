import {APIError, asyncHandler, authenticateMiddleware} from "@terreno/api";
import type express from "express";

import {getLangfuseClient} from "./langfuseClient";
import {createPrompt, invalidatePromptCache} from "./langfusePrompts";
import {requireAdmin} from "./langfuseRoutesMiddleware";
import type {ChatMessage} from "./langfuseTypes";

export const addPromptRoutes = (router: express.Application, basePath: string): void => {
  router.get(
    `${basePath}/prompts`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      const client = getLangfuseClient();
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await client.api.promptsList({limit, page});
      return res.json({
        data: result.data,
        meta: result.meta,
      });
    })
  );

  router.get(
    `${basePath}/prompts/:name`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      const client = getLangfuseClient();
      const {name} = req.params;
      const version = req.query.version ? Number(req.query.version) : undefined;
      const label = req.query.label as string | undefined;

      const prompt = await client.getPrompt(name, version, {
        cacheTtlSeconds: 0,
        ...(label ? {label} : {}),
      });

      return res.json({
        config: prompt.config,
        labels: prompt.labels,
        name: prompt.name,
        prompt: prompt.prompt,
        tags: prompt.tags,
        type: prompt.type,
        version: prompt.version,
      });
    })
  );

  router.post(
    `${basePath}/prompts`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      const {name, type, prompt, labels, tags, config} = req.body as {
        name: string;
        type: "text" | "chat";
        prompt: string | ChatMessage[];
        labels?: string[];
        tags?: string[];
        config?: Record<string, unknown>;
      };

      if (!name || !type || prompt === undefined) {
        throw new APIError({
          detail: "name, type, and prompt are required",
          status: 400,
          title: "Invalid request",
        });
      }

      const result = await createPrompt({config, labels, name, prompt, tags, type});
      return res.status(201).json(result);
    })
  );

  router.delete(
    `${basePath}/prompts/:name/cache`,
    [authenticateMiddleware(), requireAdmin],
    asyncHandler(async (req, res) => {
      await invalidatePromptCache(req.params.name);
      return res.json({invalidated: true, name: req.params.name});
    })
  );
};
