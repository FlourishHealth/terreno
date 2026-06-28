import {
  ErrorCode,
  type EvaluationContext,
  type JsonValue,
  type Logger,
  OpenFeatureEventEmitter,
  type Provider,
  type ResolutionDetails,
  ServerProviderEvents,
  StandardResolutionReasons,
} from "@openfeature/server-sdk";
import {evaluateFlag} from "./evaluate";
import type {FeatureFlagModel, SegmentFunction} from "./types";

export interface MongoFeatureFlagProviderOptions {
  flagModel: FeatureFlagModel;
  segments?: Record<string, SegmentFunction>;
}

export class MongoFeatureFlagProvider implements Provider {
  readonly metadata = {name: "MongoFeatureFlagProvider"} as const;
  readonly runsOn = "server" as const;
  readonly events = new OpenFeatureEventEmitter();

  private readonly flagModel: FeatureFlagModel;
  private readonly segments: Record<string, SegmentFunction>;

  constructor(options: MongoFeatureFlagProviderOptions) {
    this.flagModel = options.flagModel;
    this.segments = options.segments ?? {};
  }

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    _logger: Logger
  ): Promise<ResolutionDetails<boolean>> {
    return this.resolve<boolean>(flagKey, defaultValue, context, "boolean", _logger);
  }

  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    _logger: Logger
  ): Promise<ResolutionDetails<string>> {
    return this.resolve<string>(flagKey, defaultValue, context, "variant", _logger);
  }

  async resolveNumberEvaluation(
    _flagKey: string,
    defaultValue: number,
    _context: EvaluationContext,
    _logger: Logger
  ): Promise<ResolutionDetails<number>> {
    return {
      errorCode: ErrorCode.FLAG_NOT_FOUND,
      reason: StandardResolutionReasons.ERROR,
      value: defaultValue,
    };
  }

  async resolveObjectEvaluation<T extends JsonValue>(
    _flagKey: string,
    defaultValue: T,
    _context: EvaluationContext,
    _logger: Logger
  ): Promise<ResolutionDetails<T>> {
    return {
      errorCode: ErrorCode.FLAG_NOT_FOUND,
      reason: StandardResolutionReasons.ERROR,
      value: defaultValue,
    };
  }

  emitConfigurationChanged(): void {
    this.events.emit(ServerProviderEvents.ConfigurationChanged, {flagsChanged: []});
  }

  private async resolve<T extends boolean | string>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    expectedType: "boolean" | "variant",
    _logger: Logger
  ): Promise<ResolutionDetails<T>> {
    const flag = await this.flagModel.findOneOrNone({archived: {$ne: true}, key: flagKey});
    if (!flag) {
      return {
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: StandardResolutionReasons.ERROR,
        value: defaultValue,
      };
    }

    if (flag.type !== expectedType) {
      return {
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: StandardResolutionReasons.ERROR,
        value: defaultValue,
      };
    }

    if (!flag.enabled) {
      return {
        reason: StandardResolutionReasons.DISABLED,
        value: defaultValue,
        variant: flag.defaultVariant,
      };
    }

    const targetingKey = context.targetingKey ?? "";
    const userFromContext = (context as {user?: unknown}).user;
    const user = userFromContext !== undefined ? userFromContext : context;
    const result = evaluateFlag(flag, targetingKey, user, this.segments);

    if (expectedType === "boolean") {
      const value = result as boolean as T;
      return {
        reason: StandardResolutionReasons.TARGETING_MATCH,
        value,
        variant: value ? "on" : "off",
      };
    }

    if (result === null) {
      return {
        reason: StandardResolutionReasons.DISABLED,
        value: defaultValue,
        variant: flag.defaultVariant,
      };
    }

    return {
      reason: StandardResolutionReasons.TARGETING_MATCH,
      value: result as T,
      variant: result as string,
    };
  }
}
