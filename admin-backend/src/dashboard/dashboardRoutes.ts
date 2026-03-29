import {
  APIError,
  asyncHandler,
  authenticateMiddleware,
  checkPermissions,
  Permissions,
} from "@terreno/api";
import {randomUUID} from "crypto";
import type express from "express";
import mongoose from "mongoose";

import type {ChartConfig, DataSourceConfig, DataSourceMeta} from "./chartTypes";
import {validateChartConfig} from "./chartTypes";
import {Dashboard} from "./dashboard";
import {executeQuery} from "./dashboardQueryEngine";

const BASE_PATH = "/admin";

export interface DashboardRouteOptions {
  dataSources: DataSourceConfig[];
  supportsWindowFields: boolean;
  mongodbVersion: string;
}

const requireAdmin = async (req: express.Request): Promise<void> => {
  if (!(await checkPermissions("read", [Permissions.IsAdmin], req.user as any))) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
};

/** Validate and resolve ChartConfig from request body, throwing 400 on failure */
const parseChartConfig = (body: unknown): ChartConfig => {
  try {
    return validateChartConfig(body);
  } catch (err) {
    throw new APIError({
      detail: err instanceof Error ? err.message : String(err),
      status: 400,
      title: "Invalid ChartConfig",
    });
  }
};

/** Validate a list of widget chart configs — used at save time */
const validateWidgets = (widgets: unknown[]): ChartConfig[] => {
  if (!Array.isArray(widgets)) {
    throw new APIError({status: 400, title: "widgets must be an array"});
  }
  return widgets.map((w, i) => {
    const widget = w as {chart?: unknown};
    if (!widget.chart) {
      throw new APIError({status: 400, title: `Widget at index ${i} is missing 'chart'`});
    }
    try {
      return validateChartConfig(widget.chart);
    } catch (err) {
      throw new APIError({
        detail: err instanceof Error ? err.message : String(err),
        status: 400,
        title: `Widget at index ${i} has invalid ChartConfig`,
      });
    }
  });
};

const buildSourceMeta = (source: DataSourceConfig): DataSourceMeta => {
  if (source.type === "model") {
    // For simple sources, derive field types from the Mongoose schema
    const fields: DataSourceMeta["fields"] = {};
    try {
      const model = mongoose.model(source.modelName);
      for (const fieldName of source.allowedFields) {
        const path = model.schema.path(fieldName);
        const pathType = path?.instance ?? "String";
        const schemaType =
          pathType === "Number"
            ? "number"
            : pathType === "Date"
              ? "date"
              : pathType === "Boolean"
                ? "boolean"
                : "string";
        fields[fieldName] = {
          description: (path as any)?.options?.description ?? fieldName,
          role: schemaType === "number" ? "measure" : "dimension",
          type: schemaType,
        };
      }
    } catch {
      // Model not registered yet — return empty fields
    }
    return {
      displayName: source.displayName,
      fields,
      name: source.modelName,
    };
  }

  return {
    displayName: source.displayName,
    fields: source.outputFields,
    name: source.name,
  };
};

export const addDashboardRoutes = (
  app: express.Application,
  options: DashboardRouteOptions
): void => {
  const {dataSources, mongodbVersion, supportsWindowFields} = options;

  // GET /admin/dashboards — List all dashboards (paginated, sorted by -updated)
  app.get(
    `${BASE_PATH}/dashboards`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      await requireAdmin(req);

      const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10));
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10))
      );
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        Dashboard.find({deleted: false}).sort({updated: -1}).skip(skip).limit(limit).lean(),
        Dashboard.countDocuments({deleted: false}),
      ]);

      return res.json({
        data,
        limit,
        more: total > page * limit,
        page,
        total,
      });
    })
  );

  // POST /admin/dashboards — Create dashboard
  app.post(
    `${BASE_PATH}/dashboards`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      await requireAdmin(req);

      const user = req.user as {_id: mongoose.Types.ObjectId} | undefined;
      if (!user?._id) {
        throw new APIError({status: 401, title: "Authenticated user required"});
      }

      const body = req.body as {title?: unknown; description?: unknown; widgets?: unknown};

      if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
        throw new APIError({status: 400, title: "title is required"});
      }

      const rawWidgets = (body.widgets as unknown[]) ?? [];
      const validatedCharts = validateWidgets(rawWidgets);

      const widgets = validatedCharts.map((chart) => ({
        chart,
        widgetId: randomUUID(),
      }));

      const dashboard = await Dashboard.create({
        description: typeof body.description === "string" ? body.description : undefined,
        title: body.title.trim(),
        userId: user._id,
        widgets,
      });

      return res.status(201).json(dashboard.toJSON());
    })
  );

  // GET /admin/dashboards/:id — Get dashboard
  app.get(
    `${BASE_PATH}/dashboards/:id`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      await requireAdmin(req);

      const dashboard = await Dashboard.findOneOrNone({
        _id: req.params.id,
        deleted: false,
      });

      if (!dashboard) {
        throw new APIError({status: 404, title: "Dashboard not found"});
      }

      return res.json(dashboard.toJSON());
    })
  );

  // PATCH /admin/dashboards/:id — Update dashboard
  app.patch(
    `${BASE_PATH}/dashboards/:id`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      await requireAdmin(req);

      const user = req.user as {_id: mongoose.Types.ObjectId} | undefined;
      if (!user?._id) {
        throw new APIError({status: 401, title: "Authenticated user required"});
      }

      const dashboard = await Dashboard.findOneOrNone({
        _id: req.params.id,
        deleted: false,
      });

      if (!dashboard) {
        throw new APIError({status: 404, title: "Dashboard not found"});
      }

      const body = req.body as {title?: unknown; description?: unknown; widgets?: unknown};

      if (body.title !== undefined) {
        if (typeof body.title !== "string" || body.title.trim() === "") {
          throw new APIError({status: 400, title: "title must be a non-empty string"});
        }
        dashboard.title = body.title.trim();
      }

      if (body.description !== undefined) {
        if (body.description === null || body.description === "") {
          dashboard.description = undefined;
        } else if (typeof body.description === "string") {
          dashboard.description = body.description;
        }
      }

      if (body.widgets !== undefined) {
        const rawWidgets = body.widgets as unknown[];
        const validatedCharts = validateWidgets(rawWidgets);
        dashboard.widgets = validatedCharts.map((chart, i) => {
          const existing = (rawWidgets[i] as {widgetId?: string}).widgetId;
          return {
            chart,
            widgetId: existing || randomUUID(),
          };
        });
      }

      dashboard.userId = user._id;
      await dashboard.save();

      return res.json(dashboard.toJSON());
    })
  );

  // DELETE /admin/dashboards/:id — Soft-delete
  app.delete(
    `${BASE_PATH}/dashboards/:id`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      await requireAdmin(req);

      const dashboard = await Dashboard.findOneOrNone({
        _id: req.params.id,
        deleted: false,
      });

      if (!dashboard) {
        throw new APIError({status: 404, title: "Dashboard not found"});
      }

      dashboard.deleted = true;
      await dashboard.save();

      return res.status(204).send();
    })
  );

  // POST /admin/dashboards/query — Execute ChartConfig → aggregation result
  app.post(
    `${BASE_PATH}/dashboards/query`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      await requireAdmin(req);

      const chartConfig = parseChartConfig(req.body);

      const result = await executeQuery(
        chartConfig,
        {dataSources, supportsWindowFields},
        mongodbVersion
      );

      return res.json(result);
    })
  );

  // GET /admin/dashboards/sources — List registered sources + field metadata
  app.get(
    `${BASE_PATH}/dashboards/sources`,
    authenticateMiddleware(),
    asyncHandler(async (req, res) => {
      await requireAdmin(req);

      const sources: DataSourceMeta[] = dataSources.map(buildSourceMeta);

      return res.json({
        data: sources,
        supportsWindowFields,
      });
    })
  );
};
