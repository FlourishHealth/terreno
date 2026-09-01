import crypto from "node:crypto";
import type {Request} from "express";

import {headerValue} from "../headerValue";

export interface SendgridEventSignatureOptions {
  publicKey: string;
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
 */
export const sendgridEventSignature = (
  options: SendgridEventSignatureOptions
): ((req: Request) => boolean) => {
  const pem = toPem(options.publicKey);

  return (req: Request): boolean => {
    const signature = headerValue(req, "X-Twilio-Email-Event-Webhook-Signature");
    const timestamp = headerValue(req, "X-Twilio-Email-Event-Webhook-Timestamp");
    if (!signature || !timestamp || !req.rawBody) {
      return false;
    }
    try {
      const verifier = crypto.createVerify("SHA256");
      verifier.update(timestamp);
      verifier.update(req.rawBody);
      verifier.end();
      return verifier.verify(pem, signature, "base64");
    } catch {
      return false;
    }
  };
};
