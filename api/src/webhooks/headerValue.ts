import type {Request} from "express";

export const headerValue = (req: Request, header: string): string | undefined => {
  const raw = req.headers[header.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  if (typeof raw === "string") {
    return raw;
  }
  return undefined;
};
