import crypto from "node:crypto";
import type {Request} from "express";

import {headerValue} from "../headerValue";
import {timingSafeEqualUtf8} from "../timingSafeEqual";

export interface TwilioSignatureOptions {
  authToken: string;
  url?: string | ((req: Request) => string);
}

const isUrlencoded = (req: Request): boolean => {
  const contentType = headerValue(req, "content-type") ?? "";
  return contentType.toLowerCase().includes("application/x-www-form-urlencoded");
};

const resolveUrl = (
  req: Request,
  url?: string | ((req: Request) => string)
): string | undefined => {
  if (typeof url === "function") {
    return url(req);
  }
  if (typeof url === "string" && url.length > 0) {
    return url;
  }
  return undefined;
};

const formParams = (body: unknown): Record<string, string> | undefined => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value !== "string") {
      return undefined;
    }
    params[key] = value;
  }
  return params;
};

/**
 * Verifies Twilio `X-Twilio-Signature` (HMAC-SHA1 of callback URL + sorted POST fields).
 */
export const twilioSignature = (options: TwilioSignatureOptions): ((req: Request) => boolean) => {
  return (req: Request): boolean => {
    if (!isUrlencoded(req) || !req.rawBody) {
      return false;
    }
    const provided = headerValue(req, "X-Twilio-Signature");
    const callbackUrl = resolveUrl(req, options.url);
    const params = formParams(req.body);
    if (!provided || !callbackUrl || !params) {
      return false;
    }
    const keys = Object.keys(params).sort();
    let data = callbackUrl;
    for (const key of keys) {
      data += key + params[key];
    }
    const expected = crypto
      .createHmac("sha1", options.authToken)
      .update(data, "utf8")
      .digest("base64");
    return timingSafeEqualUtf8({expected, provided});
  };
};
