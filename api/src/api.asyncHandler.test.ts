import {afterEach, describe, expect, it} from "bun:test";
import express, {type NextFunction, type Request, type Response} from "express";
import supertest from "supertest";

import {asyncHandler} from "./api";
import {configureOpenApiValidator, resetOpenApiValidatorConfig} from "./openApiValidator";

afterEach(() => {
  resetOpenApiValidatorConfig();
});

const createApp = (): express.Application => {
  const app = express();
  app.use(express.json());
  return app;
};

const errorHandler = (
  err: {status?: number; title?: string; message?: string},
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(err.status || 500).json({error: err.title || err.message});
};

describe("asyncHandler with bodySchema validation", () => {
  it("validates and accepts a conforming body", async () => {
    configureOpenApiValidator({});
    const app = createApp();
    app.post(
      "/test",
      asyncHandler(
        async (_req: Request, res: Response) => {
          res.json({ok: true});
        },
        {
          bodySchema: {name: {required: true, type: "string"}},
          validate: true,
        }
      )
    );
    app.use(errorHandler);

    const res = await supertest(app).post("/test").send({name: "hello"}).expect(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects a body missing a required field", async () => {
    configureOpenApiValidator({});
    const app = createApp();
    app.post(
      "/test",
      asyncHandler(
        async (_req: Request, res: Response) => {
          res.json({ok: true});
        },
        {
          bodySchema: {name: {required: true, type: "string"}},
          validate: true,
        }
      )
    );
    app.use(errorHandler);

    await supertest(app).post("/test").send({}).expect(400);
  });

  it("skips body validation when validate is false", async () => {
    configureOpenApiValidator({});
    const app = createApp();
    app.post(
      "/test",
      asyncHandler(
        async (_req: Request, res: Response) => {
          res.json({ok: true});
        },
        {
          bodySchema: {name: {required: true, type: "string"}},
          validate: false,
        }
      )
    );
    app.use(errorHandler);

    const res = await supertest(app).post("/test").send({}).expect(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("asyncHandler with querySchema validation", () => {
  it("validates and accepts conforming query params", async () => {
    configureOpenApiValidator({});
    const app = createApp();
    app.get(
      "/test",
      asyncHandler(
        async (_req: Request, res: Response) => {
          res.json({ok: true});
        },
        {
          querySchema: {page: {type: "integer"}},
          validate: true,
        }
      )
    );
    app.use(errorHandler);

    const res = await supertest(app).get("/test?page=1").expect(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects invalid query params", async () => {
    configureOpenApiValidator({});
    const app = createApp();
    app.get(
      "/test",
      asyncHandler(
        async (_req: Request, res: Response) => {
          res.json({ok: true});
        },
        {
          querySchema: {page: {required: true, type: "integer"}},
          validate: true,
        }
      )
    );
    app.use(errorHandler);

    await supertest(app).get("/test").expect(400);
  });
});

describe("asyncHandler with both schemas", () => {
  it("runs both body and query validators sequentially", async () => {
    configureOpenApiValidator({});
    const app = createApp();
    app.post(
      "/test",
      asyncHandler(
        async (_req: Request, res: Response) => {
          res.json({ok: true});
        },
        {
          bodySchema: {name: {required: true, type: "string"}},
          querySchema: {page: {type: "integer"}},
          validate: true,
        }
      )
    );
    app.use(errorHandler);

    const res = await supertest(app).post("/test?page=1").send({name: "hi"}).expect(200);
    expect(res.body.ok).toBe(true);
  });

  it("forwards handler errors through next", async () => {
    configureOpenApiValidator({});
    const app = createApp();
    app.post(
      "/test",
      asyncHandler(
        async () => {
          throw new Error("handler boom");
        },
        {
          bodySchema: {name: {type: "string"}},
          validate: true,
        }
      )
    );
    app.use(errorHandler);

    const res = await supertest(app).post("/test").send({name: "ok"}).expect(500);
    expect(res.body.error).toBe("handler boom");
  });
});
