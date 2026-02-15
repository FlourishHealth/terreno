import type {LanguageModel} from "ai";
import {generateText as aiGenerateText, streamText} from "ai";
import type mongoose from "mongoose";

import {AIRequest} from "../models/aiRequest";
import type {
  AIRequestType,
  AIServiceOptions,
  GenerateChatStreamOptions,
  GenerateStreamOptions,
  GenerateTextOptions,
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

export class AIService {
  private model: LanguageModel;
  private defaultTemperature: number;

  constructor({model, defaultTemperature = TemperaturePresets.DEFAULT}: AIServiceOptions) {
    this.model = model;
    this.defaultTemperature = defaultTemperature;
  }

  get modelId(): string {
    return this.model.modelId;
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
    const {prompt, systemPrompt, temperature, maxTokens, userId} = options;
    const startTime = Date.now();

    try {
      const result = await aiGenerateText({
        maxTokens,
        model: this.model,
        prompt,
        system: systemPrompt,
        temperature: temperature ?? this.defaultTemperature,
      });

      const responseTime = Date.now() - startTime;
      await this.logRequest({
        aiModel: this.model.modelId,
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
        aiModel: this.model.modelId,
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
    const {prompt, systemPrompt, temperature, maxTokens, userId} = options;
    const startTime = Date.now();
    let fullResponse = "";

    try {
      const result = streamText({
        maxTokens,
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
        aiModel: this.model.modelId,
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
        aiModel: this.model.modelId,
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

  async *generateChatStream(options: GenerateChatStreamOptions): AsyncGenerator<string> {
    const {messages, systemPrompt, userId} = options;
    const startTime = Date.now();
    let fullResponse = "";

    const promptText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    try {
      const result = streamText({
        messages: messages.map((m) => ({content: m.content, role: m.role})),
        model: this.model,
        system: systemPrompt ?? DEFAULT_GPT_MEMORY,
        temperature: this.defaultTemperature,
      });

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        yield chunk;
      }

      const responseTime = Date.now() - startTime;
      const usage = await result.usage;
      await this.logRequest({
        aiModel: this.model.modelId,
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
        aiModel: this.model.modelId,
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
