import {randomUUID} from "crypto";
import type mongoose from "mongoose";
import {z} from "zod";

import type {ChartConfig, DataSourceConfig} from "./chartTypes";
import {chartConfigSchema, validateChartConfig} from "./chartTypes";
import {Dashboard} from "./dashboard";
import type {QueryEngineOptions} from "./dashboardQueryEngine";
import {executeQuery} from "./dashboardQueryEngine";

// ─── Tool option types ────────────────────────────────────────────────────────

export interface DashboardToolOptions {
  dataSources: DataSourceConfig[];
  supportsWindowFields: boolean;
  mongodbVersion: string;
  /** Admin user ID injected per-request */
  userId: mongoose.Types.ObjectId;
}

// ─── Shared validation ────────────────────────────────────────────────────────

/**
 * Validates a ChartConfig and throws a user-readable error on failure.
 * Shared between route handler and AI tool executor to avoid duplication.
 */
export {validateChartConfig};

// ─── Tool factories ───────────────────────────────────────────────────────────

/**
 * Creates a Vercel AI SDK tool that generates a chart inline in GPT chat.
 * The tool runs the query and returns {chartConfig, data} — the frontend renders
 * the result as an inline ChartWidget via DashboardToolResult.
 */
export const createGenerateChartTool = (options: DashboardToolOptions) => {
  return {
    description: "Generate a chart from model data and display it inline in the chat",
    execute: async ({chartConfig}: {chartConfig: z.infer<typeof chartConfigSchema>}) => {
      const validated = validateChartConfig(chartConfig);
      const queryOptions: QueryEngineOptions = {
        dataSources: options.dataSources,
        supportsWindowFields: options.supportsWindowFields,
      };
      const result = await executeQuery(validated, queryOptions, options.mongodbVersion);
      return {
        chartConfig: validated,
        data: result.data,
        meta: result.meta,
      };
    },
    parameters: z.object({
      chartConfig: chartConfigSchema,
    }),
  };
};

/**
 * Creates a Vercel AI SDK tool that persists a dashboard to the database.
 * Returns {dashboardId, title, widgetCount} — the frontend renders a
 * "View Dashboard →" link via DashboardToolResult.
 */
export const createDashboardTool = (options: DashboardToolOptions) => {
  return {
    description: "Create a persistent admin dashboard with one or more charts",
    execute: async ({
      description,
      title,
      widgets,
    }: {
      title: string;
      description?: string;
      widgets: Array<{chart: z.infer<typeof chartConfigSchema>}>;
    }) => {
      // Validate all widget configs before saving
      const validatedWidgets = widgets.map((w, i) => {
        const chart = validateChartConfig(w.chart);
        return {
          chart,
          widgetId: randomUUID(),
        };
      });

      const dashboard = await Dashboard.create({
        description,
        title,
        userId: options.userId,
        widgets: validatedWidgets,
      });

      return {
        dashboardId: dashboard._id.toString(),
        title: dashboard.title,
        widgetCount: validatedWidgets.length,
      };
    },
    parameters: z.object({
      description: z.string().optional(),
      title: z.string().min(1),
      widgets: z
        .array(
          z.object({
            chart: chartConfigSchema,
          })
        )
        .min(1),
    }),
  };
};

/**
 * Returns a Record<string, Tool> compatible with addGptRoutes `tools` option.
 * Pass this to `createRequestTools` to inject the per-request userId.
 */
export const createDashboardGptTools = (options: DashboardToolOptions): Record<string, unknown> => {
  return {
    createDashboard: createDashboardTool(options),
    generateChart: createGenerateChartTool(options),
  };
};
