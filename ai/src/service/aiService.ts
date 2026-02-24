import type {LanguageModel, ModelMessage} from "ai";
import {generateText as aiGenerateText, stepCountIs, streamText} from "ai";
import type mongoose from "mongoose";

import {AIRequest} from "../models/aiRequest";
import type {
  AIRequestType,
  AIServiceOptions,
  GenerateChatStreamOptions,
  GenerateStreamOptions,
  GenerateTextOptions,
  GptHistoryPrompt,
  RemixOptions,
  SummaryOptions,
  TranslateOptions,
} from "../types";
import {
  CONTENT_SUMMARY_PROMPT,
  DEFAULT_GPT_MEMORY,
  REMIX_PROMPT,
  TRANSLATION_PROMPT,
} from "./prompts";

export const TemperaturePresets = {
  BALANCED: 0.7,
  DEFAULT: 1.0,
  DETERMINISTIC: 0,
  HIGH: 1.5,
  LOW: 0.3,
  MAXIMUM: 2.0,
} as const;

const getModelId = (model: LanguageModel): string => {
  if (typeof model === "string") {
    return model;
  }
  return (model as {modelId?: string}).modelId ?? "unknown";
};

export class AIService {
  private model: LanguageModel;
  private defaultTemperature: number;

  constructor({model, defaultTemperature = TemperaturePresets.DEFAULT}: AIServiceOptions) {
    this.model = model;
    this.defaultTemperature = defaultTemperature;
  }

  get modelId(): string {
    return getModelId(this.model);
  }

  private async logRequest(params: {
    aiModel: string;
    error?: string;
    prompt: string;
    requestType: AIRequestType;
    response?: string;
    responseTime?: number;
    tokensUsed?: number;
    userId?: mongoose.Types.ObjectId;
  }): Promise<void> {
    try {
      await AIRequest.logRequest(params);
    } catch {
      // Logging failures should not break the main flow
    }
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const {prompt, systemPrompt, temperature, maxOutputTokens, userId} = options;
    const startTime = Date.now();

    try {
      const result = await aiGenerateText({
        maxOutputTokens,
        model: this.model,
        prompt,
        system: systemPrompt,
        temperature: temperature ?? this.defaultTemperature,
      });

      const responseTime = Date.now() - startTime;
      await this.logRequest({
        aiModel: getModelId(this.model),
        prompt,
        requestType: "general",
        response: result.text,
        responseTime,
        tokensUsed: result.usage?.totalTokens,
        userId,
      });

      return result.text;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logRequest({
        aiModel: getModelId(this.model),
        error: error instanceof Error ? error.message : String(error),
        prompt,
        requestType: "general",
        responseTime,
        userId,
      });
      throw error;
    }
  }

  async *generateTextStream(options: GenerateStreamOptions): AsyncGenerator<string> {
    const {prompt, systemPrompt, temperature, maxOutputTokens, userId} = options;
    const startTime = Date.now();
    let fullResponse = "";

    try {
      const result = streamText({
        maxOutputTokens,
        model: this.model,
        prompt,
        system: systemPrompt,
        temperature: temperature ?? this.defaultTemperature,
      });

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        yield chunk;
      }

      const responseTime = Date.now() - startTime;
      const usage = await result.usage;
      await this.logRequest({
        aiModel: getModelId(this.model),
        prompt,
        requestType: "general",
        response: fullResponse,
        responseTime,
        tokensUsed: usage?.totalTokens,
        userId,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logRequest({
        aiModel: getModelId(this.model),
        error: error instanceof Error ? error.message : String(error),
        prompt,
        requestType: "general",
        responseTime,
        userId,
      });
      throw error;
    }
  }

  async generateRemix(options: RemixOptions): Promise<string> {
    return this.generateText({
      prompt: options.text,
      systemPrompt: REMIX_PROMPT,
      temperature: TemperaturePresets.BALANCED,
      userId: options.userId,
    });
  }

  async generateSummary(options: SummaryOptions): Promise<string> {
    return this.generateText({
      prompt: options.text,
      systemPrompt: CONTENT_SUMMARY_PROMPT,
      temperature: TemperaturePresets.LOW,
      userId: options.userId,
    });
  }

  async translateText(options: TranslateOptions): Promise<string> {
    const {text, targetLanguage, sourceLanguage = "auto-detect", userId} = options;
    const systemPrompt = TRANSLATION_PROMPT.replace("{sourceLanguage}", sourceLanguage).replace(
      "{targetLanguage}",
      targetLanguage
    );

    return this.generateText({
      prompt: text,
      systemPrompt,
      temperature: TemperaturePresets.LOW,
      userId,
    });
  }

  buildMessages(prompts: GptHistoryPrompt[]): ModelMessage[] {
    const messages: ModelMessage[] = [];

    for (const prompt of prompts) {
      if (prompt.type === "tool-call" || prompt.type === "tool-result") {
        continue;
      }

      const role = prompt.type as "user" | "assistant" | "system";

      if (prompt.content && prompt.content.length > 0 && role === "user") {
        const parts: Array<{
          type: string;
          text?: string;
          image?: URL;
          data?: URL;
          mimeType?: string;
        }> = [];
        for (const part of prompt.content) {
          if (part.type === "text") {
            parts.push({text: part.text, type: "text"});
          } else if (part.type === "image") {
            parts.push({image: new URL(part.url), mimeType: part.mimeType, type: "image"});
          } else if (part.type === "file") {
            parts.push({data: new URL(part.url), mimeType: part.mimeType, type: "file"});
          }
        }
        messages.push({content: parts, role: "user"} as ModelMessage);
      } else {
        messages.push({content: prompt.text, role});
      }
    }

    return messages;
  }

  async *generateChatStream(options: GenerateChatStreamOptions): AsyncGenerator<string> {
    const {messages, systemPrompt, tools, toolChoice, stopWhen, userId} = options;
    const startTime = Date.now();
    let fullResponse = "";

    const promptText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    try {
      const result = streamText({
        messages: messages.map((m) => ({content: m.content, role: m.role})),
        model: this.model,
        stopWhen: stopWhen ?? stepCountIs(1),
        system: systemPrompt ?? DEFAULT_GPT_MEMORY,
        temperature: this.defaultTemperature,
        toolChoice,
        tools,
      });

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        yield chunk;
      }

      const responseTime = Date.now() - startTime;
      const usage = await result.usage;
      await this.logRequest({
        aiModel: getModelId(this.model),
        prompt: promptText,
        requestType: "general",
        response: fullResponse,
        responseTime,
        tokensUsed: usage?.totalTokens,
        userId,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logRequest({
        aiModel: getModelId(this.model),
        error: error instanceof Error ? error.message : String(error),
        prompt: promptText,
        requestType: "general",
        responseTime,
        userId,
      });
      throw error;
    }
  }
}
