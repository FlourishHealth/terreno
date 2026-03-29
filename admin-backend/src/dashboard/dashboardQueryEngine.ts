import {APIError} from "@terreno/api";
import mongoose from "mongoose";

import type {AxisConfig, ChartConfig, DataSourceConfig, FilterConfig} from "./chartTypes";

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const QUERY_MAX_TIME_MS = 30_000;

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface QueryEngineOptions {
  dataSources: DataSourceConfig[];
  supportsWindowFields: boolean;
}

export interface QueryResult {
  data: Record<string, unknown>[];
  meta: {
    total: number;
    truncated: boolean;
    mongodbVersion: string;
  };
}

// ─── Filter → $match stage ───────────────────────────────────────────────────

const buildFilterStage = (filter: FilterConfig): Record<string, unknown> => {
  if (filter.type === "eq") {
    return {[filter.field]: {$eq: filter.value}};
  }
  if (filter.type === "ne") {
    return {[filter.field]: {$ne: filter.value}};
  }
  if (filter.type === "gt") {
    return {[filter.field]: {$gt: filter.value}};
  }
  if (filter.type === "gte") {
    return {[filter.field]: {$gte: filter.value}};
  }
  if (filter.type === "lt") {
    return {[filter.field]: {$lt: filter.value}};
  }
  if (filter.type === "lte") {
    return {[filter.field]: {$lte: filter.value}};
  }
  if (filter.type === "in") {
    return {[filter.field]: {$in: filter.values}};
  }
  if (filter.type === "nin") {
    return {[filter.field]: {$nin: filter.values}};
  }
  if (filter.type === "dateRange") {
    const cond: Record<string, string> = {};
    if (filter.from) {
      cond.$gte = filter.from;
    }
    if (filter.to) {
      cond.$lte = filter.to;
    }
    return {[filter.field]: cond};
  }
  if (filter.type === "relative") {
    const now = new Date();
    const from = new Date(now);
    const unit = filter.unit;
    const amount = filter.amount;
    if (unit === "hour") {
      from.setHours(from.getHours() - amount);
    } else if (unit === "day") {
      from.setDate(from.getDate() - amount);
    } else if (unit === "week") {
      from.setDate(from.getDate() - amount * 7);
    } else if (unit === "month") {
      from.setMonth(from.getMonth() - amount);
    } else if (unit === "quarter") {
      from.setMonth(from.getMonth() - amount * 3);
    } else if (unit === "year") {
      from.setFullYear(from.getFullYear() - amount);
    }
    return {[filter.field]: {$gte: from}};
  }
  throw new APIError({status: 400, title: "Unknown filter type"});
};

// ─── Aggregation expression builder ─────────────────────────────────────────

const buildAggregationExpr = (axis: AxisConfig): Record<string, unknown> => {
  const {aggregation, field} = axis;

  if (!aggregation || aggregation === "count") {
    return {$sum: 1};
  }
  if (aggregation === "sum") {
    return {$sum: `$${field}`};
  }
  if (aggregation === "avg") {
    return {$avg: `$${field}`};
  }
  if (aggregation === "min") {
    return {$min: `$${field}`};
  }
  if (aggregation === "max") {
    return {$max: `$${field}`};
  }
  if (aggregation === "countDistinct") {
    // Two-pass: $addToSet then $size at projection stage
    return {$addToSet: `$${field}`};
  }
  // runningTotal and rank are handled via $setWindowFields — return sum as placeholder
  if (aggregation === "runningTotal" || aggregation === "rank") {
    return {$sum: `$${field}`};
  }
  throw new APIError({status: 400, title: `Unknown aggregation: ${aggregation}`});
};

// ─── Date trunc helper ────────────────────────────────────────────────────────

const buildDateTruncExpr = (field: string, unit: string): Record<string, unknown> => {
  return {
    $dateTrunc: {
      date: `$${field}`,
      unit,
    },
  };
};

// ─── Pipeline builder ────────────────────────────────────────────────────────

const buildPipeline = (
  config: ChartConfig,
  options: QueryEngineOptions,
  resolvedSource: DataSourceConfig
): mongoose.PipelineStage[] => {
  const pipeline: mongoose.PipelineStage[] = [];
  const limit = Math.min(config.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // For enriched sources, prepend the base pipeline
  if (resolvedSource.type === "enriched") {
    pipeline.push(...(resolvedSource.pipeline as mongoose.PipelineStage[]));
  }

  // Stage 1: $match — apply filters
  const filterConditions: Record<string, unknown>[] = [];

  // For simple sources, restrict to allowedFields via $project (applied first below if needed)
  if (resolvedSource.type === "model" && config.filters) {
    for (const filter of config.filters) {
      if (!resolvedSource.allowedFields.includes(filter.field)) {
        throw new APIError({
          status: 400,
          title: `Field '${filter.field}' is not allowed for this data source`,
        });
      }
      filterConditions.push(buildFilterStage(filter));
    }
  } else if (config.filters) {
    for (const filter of config.filters) {
      filterConditions.push(buildFilterStage(filter));
    }
  }

  if (filterConditions.length > 0) {
    pipeline.push({$match: {$and: filterConditions}});
  }

  // Validate fields for simple sources
  if (resolvedSource.type === "model") {
    const xField = Array.isArray(config.x) ? config.x.field : config.x.field;
    if (!resolvedSource.allowedFields.includes(xField)) {
      throw new APIError({
        status: 400,
        title: `Field '${xField}' is not allowed for this data source`,
      });
    }
    const yAxes = Array.isArray(config.y) ? config.y : [config.y];
    for (const axis of yAxes) {
      if (axis.aggregation !== "count" && !resolvedSource.allowedFields.includes(axis.field)) {
        throw new APIError({
          status: 400,
          title: `Field '${axis.field}' is not allowed for this data source`,
        });
      }
    }
    if (config.color && !resolvedSource.allowedFields.includes(config.color.field)) {
      throw new APIError({
        status: 400,
        title: `Field '${config.color.field}' is not allowed for this data source`,
      });
    }
  }

  // Stage 2: $addFields — apply $dateTrunc to date dimensions
  const addFieldsStage: Record<string, unknown> = {};
  const xAxis = config.x;
  if (xAxis.dateTrunc) {
    addFieldsStage[`__trunc_${xAxis.field}`] = buildDateTruncExpr(xAxis.field, xAxis.dateTrunc);
  }

  if (Object.keys(addFieldsStage).length > 0) {
    pipeline.push({$addFields: addFieldsStage});
  }

  // Stage 3: $group — by X (and color if present), aggregate Y measures
  const xGroupField = xAxis.dateTrunc ? `$__trunc_${xAxis.field}` : `$${xAxis.field}`;
  const groupId: Record<string, unknown> = {x: xGroupField};

  if (config.color) {
    groupId.color = `$${config.color.field}`;
  }

  const groupStage: Record<string, unknown> = {_id: groupId};

  const yAxes = Array.isArray(config.y) ? config.y : [config.y];
  const countDistinctFields: string[] = [];

  for (let i = 0; i < yAxes.length; i++) {
    const axis = yAxes[i];
    const key = yAxes.length === 1 ? "y" : `y${i}`;
    groupStage[key] = buildAggregationExpr(axis);
    if (axis.aggregation === "countDistinct") {
      countDistinctFields.push(key);
    }
  }

  pipeline.push({$group: groupStage as mongoose.PipelineStage.Group["$group"]});

  // Post-group: compute $size for countDistinct fields
  if (countDistinctFields.length > 0) {
    const sizeFields: Record<string, unknown> = {};
    for (const key of countDistinctFields) {
      sizeFields[key] = {$size: `$${key}`};
    }
    pipeline.push({$addFields: sizeFields});
  }

  // Stage 4: $setWindowFields — for runningTotal / rank (MongoDB 5+ only)
  const windowAxes = yAxes.filter(
    (a) => a.aggregation === "runningTotal" || a.aggregation === "rank"
  );

  if (windowAxes.length > 0) {
    if (!options.supportsWindowFields) {
      throw new APIError({
        status: 400,
        title: "runningTotal and rank aggregations require MongoDB 5+",
      });
    }

    for (let i = 0; i < yAxes.length; i++) {
      const axis = yAxes[i];
      if (axis.aggregation !== "runningTotal" && axis.aggregation !== "rank") {
        continue;
      }
      const key = yAxes.length === 1 ? "y" : `y${i}`;

      if (axis.aggregation === "runningTotal") {
        pipeline.push({
          $setWindowFields: {
            output: {
              [`${key}_running`]: {
                $sum: `$${key}`,
                window: {documents: ["unbounded", "current"] as ["unbounded", "current"]},
              },
            },
            sortBy: {[key]: 1 as const},
          },
        });
      } else {
        pipeline.push({
          $setWindowFields: {
            output: {
              [`${key}_rank`]: {$rank: {}},
            },
            sortBy: {[key]: 1 as const},
          },
        });
      }
    }
  }

  // Stage 5: $sort
  if (config.sort) {
    const direction = config.sort.direction === "asc" ? 1 : -1;
    pipeline.push({$sort: {[config.sort.field]: direction}});
  } else {
    // Default sort by x for time series readability
    pipeline.push({$sort: {"_id.x": 1}});
  }

  // Stage 6: $limit
  pipeline.push({$limit: limit});

  // Stage 7: $project — flatten _id to usable output shape
  const projectStage: Record<string, unknown> = {
    _id: 0,
    x: "$_id.x",
  };
  if (config.color) {
    projectStage.color = "$_id.color";
  }
  for (let i = 0; i < yAxes.length; i++) {
    const key = yAxes.length === 1 ? "y" : `y${i}`;
    const axis = yAxes[i];
    if (axis.aggregation === "runningTotal") {
      projectStage[key] = `$${key}_running`;
    } else if (axis.aggregation === "rank") {
      projectStage[key] = `$${key}_rank`;
    } else {
      projectStage[key] = 1;
    }
  }
  pipeline.push({$project: projectStage});

  return pipeline;
};

// ─── Auto-bucketing ───────────────────────────────────────────────────────────

const DATE_TRUNC_ORDER: ChartConfig["x"]["dateTrunc"][] = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

const coarsenDateTrunc = (
  current: ChartConfig["x"]["dateTrunc"]
): ChartConfig["x"]["dateTrunc"] | undefined => {
  if (!current) {
    return undefined;
  }
  const idx = DATE_TRUNC_ORDER.indexOf(current);
  if (idx === -1 || idx === DATE_TRUNC_ORDER.length - 1) {
    return undefined;
  }
  return DATE_TRUNC_ORDER[idx + 1];
};

// ─── Public query executor ────────────────────────────────────────────────────

export const executeQuery = async (
  config: ChartConfig,
  options: QueryEngineOptions,
  mongodbVersion: string
): Promise<QueryResult> => {
  const {dataSources, supportsWindowFields} = options;

  // Resolve data source
  const resolvedSource = dataSources.find((ds) => {
    if (ds.type === "model") {
      return ds.modelName === config.dataSource;
    }
    return ds.name === config.dataSource;
  });

  if (!resolvedSource) {
    throw new APIError({
      status: 400,
      title: `Unknown data source: '${config.dataSource}'`,
    });
  }

  // Resolve the Mongoose model
  let model: mongoose.Model<any>;
  try {
    const modelName =
      resolvedSource.type === "model" ? resolvedSource.modelName : resolvedSource.baseModel;
    model = mongoose.model(modelName);
  } catch {
    throw new APIError({
      status: 400,
      title: `Model not found: '${resolvedSource.type === "model" ? resolvedSource.modelName : resolvedSource.baseModel}'`,
    });
  }

  const limit = Math.min(config.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // Auto-bucketing: coarsen date granularity if needed
  let workingConfig = config;
  if (workingConfig.x.dateTrunc) {
    // Estimate cardinality with a count query — limit to avoid expensive scans
    const countPipeline: mongoose.PipelineStage[] = [];
    if (resolvedSource.type === "enriched") {
      countPipeline.push(...(resolvedSource.pipeline as mongoose.PipelineStage[]));
    }
    countPipeline.push({
      $group: {_id: buildDateTruncExpr(workingConfig.x.field, workingConfig.x.dateTrunc)},
    });
    countPipeline.push({$count: "total"});

    const countResult = await model
      .aggregate(countPipeline)
      .option({allowDiskUse: true, maxTimeMS: QUERY_MAX_TIME_MS});

    const estimatedCount = countResult[0]?.total ?? 0;

    if (estimatedCount > limit && workingConfig.x.dateTrunc) {
      const coarser = coarsenDateTrunc(workingConfig.x.dateTrunc);
      if (coarser) {
        workingConfig = {
          ...workingConfig,
          x: {...workingConfig.x, dateTrunc: coarser},
        };
      }
    }
  }

  const pipeline = buildPipeline(
    workingConfig,
    {dataSources, supportsWindowFields},
    resolvedSource
  );

  const data = await model
    .aggregate(pipeline)
    .option({allowDiskUse: true, maxTimeMS: QUERY_MAX_TIME_MS});

  return {
    data,
    meta: {
      mongodbVersion,
      total: data.length,
      truncated: data.length >= limit,
    },
  };
};

// Export for testing
export {buildFilterStage, buildPipeline};
