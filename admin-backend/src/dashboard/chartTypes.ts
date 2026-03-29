import {z} from "zod";

// ─── Primitive enums ────────────────────────────────────────────────────────

export type ChartType =
  | "bar"
  | "bar-horizontal"
  | "bar-stacked"
  | "bar-grouped"
  | "line"
  | "line-multi"
  | "area"
  | "area-stacked"
  | "pie"
  | "donut"
  | "scatter"
  | "bubble"
  | "heatmap"
  | "combo";

export type Aggregation =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "countDistinct"
  | "runningTotal"
  | "rank";

export type DateTrunc = "year" | "quarter" | "month" | "week" | "day" | "hour";

// ─── Axis & filter interfaces ────────────────────────────────────────────────

export interface AxisConfig {
  field: string;
  label?: string;
  aggregation?: Aggregation;
  dateTrunc?: DateTrunc;
}

export type FilterConfig =
  | {
      type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
      field: string;
      value: string | number | boolean | null;
    }
  | {type: "in" | "nin"; field: string; values: (string | number | boolean | null)[]}
  | {type: "dateRange"; field: string; from?: string; to?: string}
  | {type: "relative"; field: string; unit: DateTrunc; amount: number};

// ─── Main ChartConfig ────────────────────────────────────────────────────────

export interface ChartConfig {
  type: ChartType;
  title: string;
  dataSource: string;
  x: AxisConfig;
  y: AxisConfig | AxisConfig[];
  color?: {field: string; label?: string};
  size?: AxisConfig;
  filters?: FilterConfig[];
  sort?: {field: string; direction: "asc" | "desc"};
  limit?: number;
}

// ─── Data source config (registered at startup, never persisted) ─────────────

export interface SimpleSource {
  type: "model";
  modelName: string;
  displayName: string;
  /** Fields exposed to the query engine — required to prevent sensitive data leakage */
  allowedFields: string[];
}

export interface EnrichedSource {
  type: "enriched";
  name: string;
  displayName: string;
  /** Root model name for permissions validation (must be admin-accessible) */
  baseModel: string;
  pipeline: object[];
  outputFields: Record<
    string,
    {
      type: "string" | "number" | "date" | "boolean";
      description: string;
      role: "dimension" | "measure";
    }
  >;
}

export type DataSourceConfig = SimpleSource | EnrichedSource;

export interface DataSourceMeta {
  name: string;
  displayName: string;
  fields: Record<
    string,
    {
      type: "string" | "number" | "date" | "boolean";
      description: string;
      role: "dimension" | "measure";
    }
  >;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const chartTypeValues: [ChartType, ...ChartType[]] = [
  "bar",
  "bar-horizontal",
  "bar-stacked",
  "bar-grouped",
  "line",
  "line-multi",
  "area",
  "area-stacked",
  "pie",
  "donut",
  "scatter",
  "bubble",
  "heatmap",
  "combo",
];

const aggregationValues: [Aggregation, ...Aggregation[]] = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "countDistinct",
  "runningTotal",
  "rank",
];

const dateTruncValues: [DateTrunc, ...DateTrunc[]] = [
  "year",
  "quarter",
  "month",
  "week",
  "day",
  "hour",
];

// Filter values are constrained to primitives to prevent operator injection
const filterValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const axisConfigSchema = z.object({
  aggregation: z.enum(aggregationValues).optional(),
  dateTrunc: z.enum(dateTruncValues).optional(),
  field: z.string().min(1),
  label: z.string().optional(),
});

const filterConfigSchema = z.discriminatedUnion("type", [
  z.object({
    field: z.string().min(1),
    type: z.enum(["eq", "ne", "gt", "gte", "lt", "lte"]),
    value: filterValueSchema,
  }),
  z.object({
    field: z.string().min(1),
    type: z.enum(["in", "nin"]),
    values: z.array(filterValueSchema),
  }),
  z.object({
    field: z.string().min(1),
    from: z.string().optional(),
    to: z.string().optional(),
    type: z.literal("dateRange"),
  }),
  z.object({
    amount: z.number().int().positive(),
    field: z.string().min(1),
    type: z.literal("relative"),
    unit: z.enum(dateTruncValues),
  }),
]);

export const chartConfigSchema = z.object({
  color: z
    .object({
      field: z.string().min(1),
      label: z.string().optional(),
    })
    .optional(),
  dataSource: z.string().min(1),
  filters: z.array(filterConfigSchema).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
  size: axisConfigSchema.optional(),
  sort: z
    .object({
      direction: z.enum(["asc", "desc"]),
      field: z.string().min(1),
    })
    .optional(),
  title: z.string().min(1),
  type: z.enum(chartTypeValues),
  x: axisConfigSchema,
  y: z.union([axisConfigSchema, z.array(axisConfigSchema).min(1)]),
});

export type ChartConfigInput = z.infer<typeof chartConfigSchema>;

export const validateChartConfig = (raw: unknown): ChartConfig => {
  return chartConfigSchema.parse(raw) as ChartConfig;
};
