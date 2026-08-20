import type mongoose from "mongoose";

export type CommsErrorClass = "config" | "permanent" | "transient";

export interface SendResult {
  accepted: boolean;
  error?: string;
  errorClass?: CommsErrorClass;
  errorCode?: string;
  isPermanentFailure?: boolean;
  metadata?: Record<string, unknown>;
  providerMessageId?: string;
}

export interface MailMessage {
  dynamicTemplateData?: Record<string, unknown>;
  from?: string;
  html?: string;
  metadata?: Record<string, string>;
  replyTo?: string;
  subject: string;
  templateId?: string;
  text?: string;
  to: string | string[];
}

export type CommsChannel = "mail" | "push" | "sms" | "verification";
export type CommsMessageStatus = "bounced" | "delivered" | "failed" | "sent";

export interface CommsHookContext {
  channel: CommsChannel;
  isRetry?: boolean;
  provider: string;
}

export interface MailProvider {
  readonly id: string;
  sendMail(message: MailMessage): Promise<SendResult>;
}

export interface SmsMessage {
  body: string;
  to: string;
}

export interface SmsProvider {
  readonly id: string;
  sendSms(message: SmsMessage): Promise<SendResult>;
}

export interface PushMessage {
  badge?: number;
  body: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  title: string;
  tokens: string[];
}

export interface PushProvider {
  readonly id: string;
  sendPush(message: PushMessage): Promise<SendResult[]>;
}

export interface StartVerificationOptions {
  channel: "email" | "sms";
  to: string;
}

export interface CheckVerificationOptions {
  code: string;
  to: string;
}

export interface VerificationResult {
  error?: string;
  valid: boolean;
}

export interface VerificationProvider {
  readonly id: string;
  checkVerification(options: CheckVerificationOptions): Promise<VerificationResult>;
  startVerification(options: StartVerificationOptions): Promise<SendResult>;
}

export interface DeliveryEvent {
  channel: "mail" | "push" | "sms";
  providerMessageId: string;
  raw?: unknown;
  status: "bounced" | "delivered" | "failed" | "opened";
}

export interface CommsOptions {
  defaultFrom?: string;
  logMessages?: boolean;
  mail?: MailProvider;
  onDeliveryEvent?: (event: DeliveryEvent) => Promise<void>;
  onError?: (context: CommsHookContext, result: SendResult) => Promise<void>;
  onRetry?: (context: CommsHookContext, result: SendResult) => Promise<void>;
  onSend?: (context: CommsHookContext, result: SendResult) => Promise<void>;
  push?: PushProvider;
  redactRecipients?: boolean;
  sms?: SmsProvider;
  verification?: VerificationProvider;
}

export interface SendPushToUserMessage extends Omit<PushMessage, "tokens"> {
  userId: mongoose.Types.ObjectId | string;
}
