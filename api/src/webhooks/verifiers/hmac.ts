import crypto from "node:crypto";
import type {Request} from "express";
import {DateTime} from "luxon";

export interface HmacSignatureOptions {
  algorithm?: "sha256" | "sha1" | "sha512";
  encoding?: "hex" | "base64";
  header: string;
  secret: string;
  timestampHeader?: string;
  toleranceSec?: number;
}

const headerValue = (req: Request, header: string): string | undefined => {
  const raw = req.headers[header.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  if (typeof raw === "string") {
    return raw;
  }
  return undefined;
};

const timingSafeEqualUtf8 = ({
  expected,
  provided,
}: {
  expected: string;
  provided: string;
}): boolean => {
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
};

/**
 * Verifies `header` against HMAC of `req.rawBody`.
 * Optional `timestampHeader` rejects timestamps outside `toleranceSec` (default 300).
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
    }
    const expected = crypto
      .createHmac(algorithm, options.secret)
      .update(req.rawBody)
      .digest(encoding);
    return timingSafeEqualUtf8({expected, provided});
  };
};
