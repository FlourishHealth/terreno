import crypto from "node:crypto";
import type {Request} from "express";
import {DateTime} from "luxon";

import {headerValue} from "../headerValue";
import {timingSafeEqualUtf8} from "../timingSafeEqual";

export interface HmacSignatureOptions {
  algorithm?: "sha256" | "sha1" | "sha512";
  encoding?: "hex" | "base64";
  header: string;
  secret: string;
  timestampHeader?: string;
  toleranceSec?: number;
}

/**
 * Verifies `header` against HMAC of `req.rawBody`.
 * When `timestampHeader` is set, the MAC is HMAC(`${timestamp}.${rawBody}`) and
 * timestamps outside `toleranceSec` (default 300) are rejected.
 */
export const hmacSignature = (options: HmacSignatureOptions): ((req: Request) => boolean) => {
  const algorithm = options.algorithm ?? "sha256";
  const encoding = options.encoding ?? "hex";
  const toleranceSec = options.toleranceSec ?? 300;

  return (req: Request): boolean => {
    const provided = headerValue(req, options.header);
    if (!provided) {
      return false;
    }
    if (!req.rawBody) {
      return false;
    }
    const mac = crypto.createHmac(algorithm, options.secret);
    if (options.timestampHeader) {
      const timestampRaw = headerValue(req, options.timestampHeader);
      if (!timestampRaw) {
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
      mac.update(`${timestampRaw}.`);
    }
    const expected = mac.update(req.rawBody).digest(encoding);
    return timingSafeEqualUtf8({expected, provided});
  };
};
