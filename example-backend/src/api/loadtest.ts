/**
 * Load-test routes for the SyncDB "load lab" admin screen.
 *
 * These endpoints drive server-side writes to the owner-scoped `todos` collection so
 * the running frontend's @terreno/syncdb client sees them arrive as inbound `sync:delta`
 * patches over the websocket — i.e. they simulate "other clients" mutating shared data.
 *
 * - generate: bulk-insert N random todos (one insertMany → N change-stream inserts → N deltas).
 * - churn:    perform a batch of random create/update/delete ops (the frontend calls this on
 *             an interval to produce a continuous stream of inbound patches).
 * - clear:    soft-delete every todo for the user (emits tombstone deltas so clients drop them).
 *
 * Admin-guarded because the screen lives in the admin panel. All writes target the current
 * user's owner stream, so the caller's own syncdb client receives the deltas. Writes go
 * through the model (insertMany / save) so the syncPlugin stamps `_syncSeq` and the change
 * stream fires — hard/bulk deletes are intentionally avoided (unsupported on synced models).
 */
import type {ModelRouterOptions} from "@terreno/api";
import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";
import {Todo} from "../models";
import type {TodoDocument, UserDocument} from "../types";

/** Hard caps so a stray UI value can't wedge the dev server. */
const MAX_GENERATE = 5_000;
const MAX_CHURN_OPS = 500;
/** Save concurrency for update/delete batches. */
const SAVE_CHUNK = 25;

const TITLE_ADJECTIVES = [
  "Urgent",
  "Quick",
  "Blocked",
  "Draft",
  "Recurring",
  "Legacy",
  "Flaky",
  "Critical",
  "Minor",
  "Stale",
];
const TITLE_NOUNS = [
  "sync audit",
  "cache purge",
  "delta replay",
  "outbox flush",
  "conflict merge",
  "cursor rebuild",
  "socket reconnect",
  "snapshot import",
  "index migration",
  "tombstone sweep",
];
const PRIORITIES = ["low", "medium", "high"] as const;
const TAG_POOL = ["load", "sync", "delta", "outbox", "conflict", "realtime", "bench", "chaos"];

const randomInt = (max: number): number => Math.floor(Math.random() * max);

const randomTitle = (): string =>
  `${TITLE_ADJECTIVES[randomInt(TITLE_ADJECTIVES.length)]} ${
    TITLE_NOUNS[randomInt(TITLE_NOUNS.length)]
  } #${randomInt(100_000)}`;

const randomTags = (): string[] => {
  const count = randomInt(3);
  const tags = new Set<string>();
  for (let i = 0; i < count; i++) {
    tags.add(TAG_POOL[randomInt(TAG_POOL.length)]);
  }
  return [...tags];
};

const buildTodoSeed = (ownerId: unknown): Record<string, unknown> => ({
  completed: Math.random() < 0.25,
  ownerId,
  priority: PRIORITIES[randomInt(PRIORITIES.length)],
  tags: randomTags(),
  title: randomTitle(),
});

const requireOwnerId = (req: express.Request): unknown => {
  const ownerId = (req.user as unknown as UserDocument)?._id;
  if (!ownerId) {
    throw new APIError({status: 401, title: "Authentication required"});
  }
  return ownerId;
};

const adminGuard = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): void => {
  const user = req.user as unknown as UserDocument | undefined;
  if (!user?.admin) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
  next();
};

/** Run `task` over `items` with bounded concurrency so batches don't open 1000 sockets at once. */
const runChunked = async <T>(items: T[], task: (item: T) => Promise<void>): Promise<void> => {
  for (let i = 0; i < items.length; i += SAVE_CHUNK) {
    const chunk = items.slice(i, i + SAVE_CHUNK);
    await Promise.all(chunk.map(task));
  }
};

/** Sample up to `size` random non-deleted todo documents for the owner. */
const sampleTodos = async (ownerId: unknown, size: number): Promise<TodoDocument[]> => {
  if (size <= 0) {
    return [];
  }
  const sampled = (await Todo.aggregate([
    {$match: {deleted: {$ne: true}, ownerId}},
    {$sample: {size}},
    {$project: {_id: 1}},
  ])) as {_id: string}[];
  if (sampled.length === 0) {
    return [];
  }
  return Todo.find({_id: {$in: sampled.map((row) => row._id)}});
};

const clampCount = (value: unknown, max: number): number => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }
  return Math.min(Math.floor(num), max);
};

export const addLoadTestRoutes = (
  // biome-ignore lint/suspicious/noExplicitAny: Router type flexibility (matches addSettingsRoutes)
  router: any,
  // biome-ignore lint/suspicious/noExplicitAny: Router type flexibility
  options?: Partial<ModelRouterOptions<any>>
): void => {
  router.post(
    "/loadtest/todos/generate",
    [
      authenticateMiddleware(),
      adminGuard,
      createOpenApiBuilder(options ?? {})
        .withTags(["loadtest"])
        .withSummary("Bulk-generate random todos for the current user (load testing)")
        .withRequestBody({count: {type: "number"}})
        .withResponse(200, {data: {properties: {created: {type: "number"}}, type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const ownerId = requireOwnerId(req);
      const count = clampCount((req.body as {count?: number})?.count ?? 1_000, MAX_GENERATE);
      if (count === 0) {
        return res.json({data: {created: 0}});
      }
      const seeds = Array.from({length: count}, () => buildTodoSeed(ownerId));
      // insertMany stamps a batched _syncSeq range per stream and fires one change-stream
      // insert per document → one sync:delta per todo over the websocket.
      await Todo.insertMany(seeds);
      return res.json({data: {created: count}});
    })
  );

  router.post(
    "/loadtest/todos/churn",
    [
      authenticateMiddleware(),
      adminGuard,
      createOpenApiBuilder(options ?? {})
        .withTags(["loadtest"])
        .withSummary("Apply a batch of random create/update/delete todo ops (load testing)")
        .withRequestBody({
          creates: {type: "number"},
          deletes: {type: "number"},
          updates: {type: "number"},
        })
        .withResponse(200, {
          data: {
            properties: {
              created: {type: "number"},
              deleted: {type: "number"},
              updated: {type: "number"},
            },
            type: "object",
          },
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const ownerId = requireOwnerId(req);
      const body = (req.body ?? {}) as {creates?: number; updates?: number; deletes?: number};
      const creates = clampCount(body.creates ?? 0, MAX_CHURN_OPS);
      const updates = clampCount(body.updates ?? 0, MAX_CHURN_OPS);
      const deletes = clampCount(body.deletes ?? 0, MAX_CHURN_OPS);

      if (creates > 0) {
        await Todo.insertMany(Array.from({length: creates}, () => buildTodoSeed(ownerId)));
      }

      // Sample once for the combined update+delete demand, then split the pool so the same
      // document is never both updated and deleted in one tick.
      const pool = await sampleTodos(ownerId, updates + deletes);
      const toUpdate = pool.slice(0, updates);
      const toDelete = pool.slice(updates, updates + deletes);

      await runChunked(toUpdate, async (todo) => {
        // Toggle completed and bump a field so every update is a real content change.
        todo.completed = !todo.completed;
        todo.priority = PRIORITIES[randomInt(PRIORITIES.length)];
        await todo.save();
      });

      await runChunked(toDelete, async (todo) => {
        // Soft delete: an update setting deleted=true → tombstone sync:delta.
        todo.deleted = true;
        await todo.save();
      });

      return res.json({
        data: {created: creates, deleted: toDelete.length, updated: toUpdate.length},
      });
    })
  );

  router.post(
    "/loadtest/todos/clear",
    [
      authenticateMiddleware(),
      adminGuard,
      createOpenApiBuilder(options ?? {})
        .withTags(["loadtest"])
        .withSummary("Soft-delete every todo for the current user (load testing reset)")
        .withResponse(200, {data: {properties: {deleted: {type: "number"}}, type: "object"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const ownerId = requireOwnerId(req);
      const todos = await Todo.find({deleted: {$ne: true}, ownerId});
      await runChunked(todos, async (todo) => {
        todo.deleted = true;
        await todo.save();
      });
      return res.json({data: {deleted: todos.length}});
    })
  );
};
