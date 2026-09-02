import crypto from "node:crypto";

export const timingSafeEqualUtf8 = ({
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
