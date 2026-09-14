import crypto from "node:crypto";
import type {Request} from "express";
import {DateTime} from "luxon";

import {headerValue} from "../headerValue";

export interface SendgridEventSignatureOptions {
  publicKey: string;
  toleranceSec?: number;
}

const PEM_HEADER = "-----BEGIN PUBLIC KEY-----";
const PEM_FOOTER = "-----END PUBLIC KEY-----";

const toPem = (publicKey: string): string => {
  const trimmed = publicKey.trim();
  if (trimmed.includes(PEM_HEADER)) {
    return trimmed;
  }
  const body = trimmed.replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `${PEM_HEADER}\n${wrapped}\n${PEM_FOOTER}`;
};

/**
 * Verifies SendGrid Event Webhook ECDSA P-256 over `${timestamp}${rawBody}`.
 * Timestamps outside `toleranceSec` (default 300) are rejected.
 */
export const sendgridEventSignature = (
  options: SendgridEventSignatureOptions
): ((req: Request) => boolean) => {
  const pem = toPem(options.publicKey);
  const toleranceSec = options.toleranceSec ?? 300;

  return (req: Request): boolean => {
    const signature = headerValue(req, "X-Twilio-Email-Event-Webhook-Signature");
    const timestampRaw = headerValue(req, "X-Twilio-Email-Event-Webhook-Timestamp");
    if (!signature || !timestampRaw || !req.rawBody) {
      return false;
    }
    const timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    const nowSec = DateTime.utc().toUnixInteger();
    if (Math.abs(nowSec - timestamp) > toleranceSec) {
      return false;
    }
    try {
      const verifier = crypto.createVerify("SHA256");
      verifier.update(timestampRaw);
      verifier.update(req.rawBody);
      verifier.end();
      return verifier.verify(pem, signature, "base64");
    } catch {
      return false;
    }
  };
};
