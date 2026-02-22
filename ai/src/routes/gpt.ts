import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type {CoreTool} from "ai";
import {streamText} from "ai";
import type express from "express";
import type mongoose from "mongoose";

import {GptHistory} from "../models/gptHistory";
import type {GptHistoryPrompt, GptRouteOptions, MessageContentPart} from "../types";

export const addGptRoutes = (router: any, options: GptRouteOptions): void => {
  const {aiService, mcpService, tools: routeTools, toolChoice, maxSteps} = options;

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
        const result = streamText({
          maxSteps: maxSteps ?? (allTools ? 5 : 1),
          messages,
          model: (aiService as any).model,
          system: systemPrompt ?? undefined,
          temperature: (aiService as any).defaultTemperature,
          toolChoice: allTools ? (toolChoice ?? "auto") : undefined,
          tools: allTools,
        });

        for await (const part of result.fullStream as AsyncIterable<{
          type: string;
          [key: string]: any;
        }>) {
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
