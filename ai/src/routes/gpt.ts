import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder, logger} from "@terreno/api";
import type {CoreTool} from "ai";
import {streamText} from "ai";
import type express from "express";
import type mongoose from "mongoose";

import {GptHistory} from "../models/gptHistory";
import {AIService} from "../service/aiService";
import type {GptHistoryPrompt, GptRouteOptions, MessageContentPart} from "../types";

const DEMO_RESPONSE =
  "This is demo mode. To use AI features, paste your Gemini API key in Settings.";

/** Send a canned SSE demo response when no AI service is available. */
const sendDemoResponse = (res: express.Response, historyId?: string): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify({text: DEMO_RESPONSE})}\n\n`);
  res.write(`data: ${JSON.stringify({done: true, ...(historyId ? {historyId} : {})})}\n\n`);
  res.end();
};

/**
 * Resolve the AIService for a request. Priority:
 * 1. Per-request API key via `x-ai-api-key` header (creates a temporary AIService)
 * 2. Pre-configured aiService from route options
 * 3. undefined (triggers demo mode response)
 */
const resolveAiService = (
  req: express.Request,
  options: GptRouteOptions
): AIService | undefined => {
  const perRequestKey = req.headers["x-ai-api-key"] as string | undefined;
  if (perRequestKey && options.createModelFn) {
    return new AIService({model: options.createModelFn(perRequestKey)});
  }
  return options.aiService;
};

export const addGptRoutes = (router: any, options: GptRouteOptions): void => {
  const {mcpService, tools: routeTools, toolChoice, maxSteps} = options;

  router.post(
    "/gpt/prompt",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options.openApiOptions ?? {})
        .withTags(["gpt"])
        .withSummary("Stream a GPT chat response")
        .withRequestBody({
          attachments: {
            items: {
              properties: {
                filename: {type: "string"},
                mimeType: {type: "string"},
                type: {type: "string"},
                url: {type: "string"},
              },
              type: "object",
            },
            type: "array",
          },
          historyId: {type: "string"},
          prompt: {type: "string"},
          systemPrompt: {type: "string"},
        })
        .withResponse(200, {data: {type: "string"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const {prompt, historyId, systemPrompt, attachments} = req.body;
      const userId = (req as any).user?._id as mongoose.Types.ObjectId | undefined;

      if (!prompt || typeof prompt !== "string") {
        throw new APIError({status: 400, title: "prompt is required"});
      }

      // Resolve AI service (per-request key takes priority, then configured service)
      const hasPerRequestKey = !!req.headers["x-ai-api-key"];
      const hasCreateModelFn = !!options.createModelFn;
      const hasConfiguredService = !!options.aiService;
      logger.debug("Resolving AI service", {hasConfiguredService, hasCreateModelFn, hasPerRequestKey});

      const aiService = resolveAiService(req, options);
      if (!aiService) {
        logger.debug("No AI service available, sending demo response");
        return sendDemoResponse(res);
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

      // Build content parts from attachments
      const contentParts: MessageContentPart[] = [{text: prompt, type: "text"}];
      if (attachments && Array.isArray(attachments)) {
        for (const attachment of attachments) {
          if (attachment.type === "image") {
            contentParts.push({
              mimeType: attachment.mimeType,
              type: "image",
              url: attachment.url,
            });
          } else if (attachment.type === "file") {
            contentParts.push({
              filename: attachment.filename,
              mimeType: attachment.mimeType,
              type: "file",
              url: attachment.url,
            });
          }
        }
      }

      // Add user prompt to history
      const hasAttachments = contentParts.length > 1;
      const userPrompt: GptHistoryPrompt = {
        text: prompt,
        type: "user",
        ...(hasAttachments ? {content: contentParts} : {}),
      };
      history.prompts.push(userPrompt);

      // Build messages from history using AIService helper
      const messages = aiService.buildMessages(history.prompts);

      // Merge tools from route config and MCP service
      let allTools: Record<string, CoreTool> | undefined;
      if (routeTools || mcpService) {
        allTools = {...(routeTools ?? {})};
        if (mcpService) {
          try {
            const mcpTools = await mcpService.getTools();
            Object.assign(allTools, mcpTools);
          } catch {
            // MCP tool discovery failure should not block the request
          }
        }
      }

      // Stream response via SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let fullResponse = "";
      try {
        logger.debug("Starting streamText", {model: (aiService as any).model?.modelId});
        const result = streamText({
          maxSteps: maxSteps ?? (allTools ? 5 : 1),
          messages,
          model: (aiService as any).model,
          system: systemPrompt ?? undefined,
          temperature: (aiService as any).defaultTemperature,
          toolChoice: allTools ? (toolChoice ?? "auto") : undefined,
          tools: allTools,
        });

        let partCount = 0;
        for await (const part of result.fullStream as AsyncIterable<{
          type: string;
          [key: string]: any;
        }>) {
          partCount++;
          if (partCount <= 3 || part.type === "error") {
            logger.debug("Stream part", {error: part.type === "error" ? String(part.error ?? part) : undefined, partCount, type: part.type});
          }
          if (part.type === "error") {
            const errMsg = part.error instanceof Error ? part.error.message : String(part.error ?? "Unknown stream error");
            logger.error("AI stream error part", {error: errMsg});
            res.write(`data: ${JSON.stringify({error: errMsg})}\n\n`);
            continue;
          }
          if (part.type === "text-delta") {
            fullResponse += part.textDelta;
            res.write(`data: ${JSON.stringify({text: part.textDelta})}\n\n`);
          } else if (part.type === "tool-call") {
            res.write(
              `data: ${JSON.stringify({
                toolCall: {
                  args: part.args,
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                },
              })}\n\n`
            );
            // Persist tool call in history
            history.prompts.push({
              args: part.args as Record<string, unknown>,
              text: `Tool call: ${part.toolName}`,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              type: "tool-call",
            });
          } else if (part.type === "tool-result") {
            res.write(
              `data: ${JSON.stringify({
                toolResult: {
                  result: part.result,
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                },
              })}\n\n`
            );
            // Persist tool result in history
            history.prompts.push({
              result: part.result as unknown,
              text: `Tool result: ${part.toolName}`,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              type: "tool-result",
            });
          }
        }

        logger.debug("Stream completed", {fullResponseLength: fullResponse.length, partCount});

        // Save assistant response to history
        if (fullResponse) {
          const assistantPrompt: GptHistoryPrompt = {
            model: aiService.modelId,
            text: fullResponse,
            type: "assistant",
          };
          history.prompts.push(assistantPrompt);
        }
        await history.save();

        res.write(`data: ${JSON.stringify({done: true, historyId: history._id.toString()})}\n\n`);
        res.end();
      } catch (error) {
        logger.error("Error in GPT stream", {error: error instanceof Error ? error.message : String(error)});
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

      const aiService = resolveAiService(req, options);
      if (!aiService) {
        return res.json({data: DEMO_RESPONSE});
      }

      const result = await aiService.generateRemix({text, userId});
      return res.json({data: result});
    })
  );
};
