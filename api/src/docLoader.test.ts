// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import {loadDocOr404} from "./docLoader";
import {APIError} from "./errors";

describe("loadDocOr404", () => {
  it("returns hidden reason metadata when document is deleted", async () => {
    const model = {
      collection: {findOne: mock(async () => ({deleted: true}))},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;

    try {
      await loadDocOr404(model, "507f1f77bcf86cd799439011");
      expect.unreachable("expected loadDocOr404 to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      const apiError = error as APIError;
      expect(apiError.status).toBe(404);
      expect(apiError.meta).toEqual({deleted: "true"});
      expect(apiError.disableExternalErrorTracking).toBe(true);
    }
  });

  it("returns plain not found when document does not exist", async () => {
    const model = {
      collection: {findOne: mock(async () => null)},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;

    try {
      await loadDocOr404(model, "507f1f77bcf86cd799439011");
      expect.unreachable("expected loadDocOr404 to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      const apiError = error as APIError;
      expect(apiError.status).toBe(404);
      expect(apiError.meta).toBeUndefined();
    }
  });
});
