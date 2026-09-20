import crypto from "node:crypto";
import type {Request} from "express";
import {DateTime} from "luxon";

import {headerValue} from "../headerValue";
import {timingSafeEqualUtf8} from "../timingSafeEqual";

export interface StripeSignatureOptions {
  secret: string;
  toleranceSec?: number;
}

const parseStripeSignature = (header: string): {timestamp: string | undefined; v1: string[]} => {
  let timestamp: string | undefined;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      v1.push(value);
    }
  }
  return {timestamp, v1};
};

/**
 * Verifies Stripe `Stripe-Signature` (`t=` / `v1=`) against HMAC-SHA256 of `${t}.${rawBody}`.
 */
export const stripeSignature = (options: StripeSignatureOptions): ((req: Request) => boolean) => {
  const toleranceSec = options.toleranceSec ?? 300;

  return (req: Request): boolean => {
    const header = headerValue(req, "Stripe-Signature");
    if (!header || !req.rawBody) {
      return false;
    }
    const parsed = parseStripeSignature(header);
    if (!parsed.timestamp || parsed.v1.length === 0) {
      return false;
    }
    const timestamp = Number(parsed.timestamp);
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    const nowSec = DateTime.utc().toUnixInteger();
    if (Math.abs(nowSec - timestamp) > toleranceSec) {
      return false;
    }
    const expected = crypto
      .createHmac("sha256", options.secret)
      .update(`${parsed.timestamp}.`)
      .update(req.rawBody)
      .digest("hex");
    for (const provided of parsed.v1) {
      if (timingSafeEqualUtf8({expected, provided})) {
        return true;
      }
    }
    return false;
  };
};
