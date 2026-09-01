import type {IncomingMessage, OutgoingMessage} from "node:http";
import type {Request} from "express";

/**
 * Copies the parsed request buffer onto `req.rawBody`.
 * Express may reuse `buf`; webhook signatures need the original bytes.
 */
export const captureRawBody = (
  req: IncomingMessage,
  _res: OutgoingMessage,
  buf: Buffer
): void => {
  if (!Buffer.isBuffer(buf)) {
    return;
  }
  (req as Request).rawBody = Buffer.from(buf);
};

export const jsonBodyParserOptions = {
  limit: "50mb" as const,
  verify: captureRawBody,
};

export const urlencodedBodyParserOptions = {
  extended: false as const,
  verify: captureRawBody,
};
