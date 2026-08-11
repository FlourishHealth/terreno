import type mongoose from "mongoose";

export type CommsChannel = "mail" | "sms" | "push" | "verification";
export type DeliveryStatus = "bounced" | "delivered" | "failed" | "opened";
export type MessageStatus = "bounced" | "delivered" | "failed" | "sent";
export type PushPlatform = "android" | "ios" | "web";
export type VerificationChannel = "email" | "sms";

export interface SendResult {
  accepted: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  permanentFailure?: boolean;
  providerMessageId?: string;
}

export interface MailMessage {
  from?: string;
  html?: string;
  metadata?: Record<string, string>;
  replyTo?: string;
  subject: string;
  text?: string;
  to: string | string[];
}

export interface SmsMessage {
  body: string;
  to: string;
}

export interface PushMessage {
  badge?: number;
  body: string;
  data?: Record<string, unknown>;
  sound?: null | string;
  title: string;
  tokens: string[];
}

export interface StartVerificationOptions {
  channel: VerificationChannel;
  to: string;
}

export interface CheckVerificationOptions {
  code: string;
  to: string;
}

export interface VerificationResult {
  valid: boolean;
}

export interface MailProvider {
  readonly id: string;
  sendMail(message: MailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  readonly id: string;
  sendSms(message: SmsMessage): Promise<SendResult>;
}

export interface PushProvider {
  readonly id: string;
  sendPush(message: PushMessage): Promise<SendResult[]>;
}

export interface VerificationProvider {
  readonly id: string;
  checkVerification(options: CheckVerificationOptions): Promise<VerificationResult>;
  startVerification(options: StartVerificationOptions): Promise<SendResult>;
}

export interface DeliveryEvent {
  channel: Exclude<CommsChannel, "verification">;
  providerMessageId: string;
  raw?: unknown;
  status: DeliveryStatus;
}

export interface LogSendParams {
  channel: CommsChannel;
  error?: string;
  metadata?: Record<string, unknown>;
  provider: string;
  providerMessageId?: string;
  status: MessageStatus;
  subject?: string;
  to: string;
  userId?: mongoose.Types.ObjectId | string;
}

export type CommsMessageDocument = mongoose.Document<mongoose.Types.ObjectId> & {
  channel: CommsChannel;
  created: Date;
  deleted: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  provider: string;
  providerMessageId?: string;
  status: MessageStatus;
  subject?: string;
  to: string;
  updated: Date;
  userId?: mongoose.Types.ObjectId;
};

export interface CommsMessageStatics {
  logSend(params: LogSendParams): Promise<CommsMessageDocument | undefined>;
}

export type CommsMessageModel = mongoose.Model<CommsMessageDocument> & CommsMessageStatics;
