import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";
import type mongoose from "mongoose";

import {GptHistory} from "../models/gptHistory";
import type {GptHistoryPrompt, GptRouteOptions} from "../types";

export const addGptRoutes = (router: any, options: GptRouteOptions): void => {
  const {aiService} = options;

  router.post(
    "/gpt/prompt",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options.openApiOptions ?? {})
        .withTags(["gpt"])
        .withSummary("Stream a GPT chat response")
        .withRequestBody({
          historyId: {type: "string"},
          prompt: {type: "string"},
          systemPrompt: {type: "string"},
        })
        .withResponse(200, {data: {type: "string"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const {prompt, historyId, systemPrompt} = req.body;
      const userId = (req as any).user?._id as mongoose.Types.ObjectId | undefined;

      if (!prompt || typeof prompt !== "string") {
        throw new APIError({status: 400, title: "prompt is required"});
      }

      // Load or create history
      let history;
      if (historyId) {
        history = await GptHistory.findById(historyId);
        if (!history) {
          throw new APIError({status: 404, title: "History not found"});
        }
        if (history.userId.toString() !== userId?.toString()) {
          throw new APIError({status: 403, title: "Not authorized to access this history"});
        }
      } else {
        history = new GptHistory({prompts: [], userId});
      }

      // Add user prompt to history
      const userPrompt: GptHistoryPrompt = {text: prompt, type: "user"};
      history.prompts.push(userPrompt);

      // Build messages from history
      const messages = history.prompts.map((p) => ({
        content: p.text,
        role: p.type as "user" | "assistant" | "system",
      }));

      // Stream response via SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullResponse = "";
      try {
        const stream = aiService.generateChatStream({
          messages,
          systemPrompt,
          userId,
        });

        for await (const chunk of stream) {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({text: chunk})}\n\n`);
        }

        // Save assistant response to history
        const assistantPrompt: GptHistoryPrompt = {
          model: aiService.modelId,
          text: fullResponse,
          type: "assistant",
        };
        history.prompts.push(assistantPrompt);
        await history.save();

        res.write(`data: ${JSON.stringify({done: true, historyId: history._id.toString()})}\n\n`);
        res.end();
      } catch (error) {
        res.write(
          `data: ${JSON.stringify({error: error instanceof Error ? error.message : "Unknown error"})}\n\n`
        );
        res.end();
      }
    })
  );

  router.post(
    "/gpt/remix",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options.openApiOptions ?? {})
        .withTags(["gpt"])
        .withSummary("Remix text")
        .withRequestBody({
          text: {type: "string"},
        })
        .withResponse(200, {data: {type: "string"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const {text} = req.body;
      const userId = (req as any).user?._id as mongoose.Types.ObjectId | undefined;

      if (!text || typeof text !== "string") {
        throw new APIError({status: 400, title: "text is required"});
      }

      const result = await aiService.generateRemix({text, userId});
      return res.json({data: result});
    })
  );
};
