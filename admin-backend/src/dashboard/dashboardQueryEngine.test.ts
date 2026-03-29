import {describe, expect, it} from "bun:test";

import type {ChartConfig, DataSourceConfig} from "./chartTypes";
import {buildFilterStage, buildPipeline} from "./dashboardQueryEngine";

const mockSimpleSource: DataSourceConfig = {
  allowedFields: ["status", "amount", "created", "email", "count"],
  displayName: "Test Model",
  modelName: "TestModel",
  type: "model",
};

const mockEnrichedSource: DataSourceConfig = {
  baseModel: "TestModel",
  displayName: "Test Enriched",
  name: "TestEnriched",
  outputFields: {
    amount: {description: "Amount", role: "measure", type: "number"},
    status: {description: "Status", role: "dimension", type: "string"},
  },
  pipeline: [{$match: {active: true}}],
  type: "enriched",
};

const baseConfig: ChartConfig = {
  dataSource: "TestModel",
  limit: 100,
  sort: {direction: "asc", field: "x"},
  title: "Test Chart",
  type: "bar",
  x: {field: "status"},
  y: {aggregation: "count", field: "count"},
};

const defaultOptions = {
  dataSources: [mockSimpleSource, mockEnrichedSource],
  supportsWindowFields: true,
};

// ─── Filter stage tests ───────────────────────────────────────────────────────

describe("buildFilterStage", () => {
  it("builds eq filter", () => {
    expect(buildFilterStage({field: "status", type: "eq", value: "active"})).toEqual({
      status: {$eq: "active"},
    });
  });

  it("builds ne filter", () => {
    expect(buildFilterStage({field: "status", type: "ne", value: "deleted"})).toEqual({
      status: {$ne: "deleted"},
    });
  });

  it("builds gt filter", () => {
    expect(buildFilterStage({field: "amount", type: "gt", value: 100})).toEqual({
      amount: {$gt: 100},
    });
  });

  it("builds gte filter", () => {
    expect(buildFilterStage({field: "amount", type: "gte", value: 0})).toEqual({
      amount: {$gte: 0},
    });
  });

  it("builds lt filter", () => {
    expect(buildFilterStage({field: "amount", type: "lt", value: 50})).toEqual({
      amount: {$lt: 50},
    });
  });

  it("builds lte filter", () => {
    expect(buildFilterStage({field: "amount", type: "lte", value: 1000})).toEqual({
      amount: {$lte: 1000},
    });
  });

  it("builds in filter", () => {
    expect(buildFilterStage({field: "status", type: "in", values: ["active", "pending"]})).toEqual({
      status: {$in: ["active", "pending"]},
    });
  });

  it("builds nin filter", () => {
    expect(buildFilterStage({field: "status", type: "nin", values: ["deleted"]})).toEqual({
      status: {$nin: ["deleted"]},
    });
  });

  it("builds dateRange filter with from and to", () => {
    const result = buildFilterStage({
      field: "created",
      from: "2024-01-01",
      to: "2024-12-31",
      type: "dateRange",
    });
    expect(result).toEqual({
      created: {$gte: "2024-01-01", $lte: "2024-12-31"},
    });
  });

  it("builds dateRange filter with only from", () => {
    const result = buildFilterStage({field: "created", from: "2024-01-01", type: "dateRange"});
    expect(result).toEqual({created: {$gte: "2024-01-01"}});
  });

  it("builds relative filter", () => {
    const result = buildFilterStage({amount: 30, field: "created", type: "relative", unit: "day"});
    expect(result.created).toBeDefined();
    expect((result.created as any).$gte).toBeInstanceOf(Date);
  });

  it("handles null value in eq filter", () => {
    expect(buildFilterStage({field: "email", type: "eq", value: null})).toEqual({
      email: {$eq: null},
    });
  });

  it("handles boolean value in eq filter", () => {
    expect(buildFilterStage({field: "status", type: "eq", value: true})).toEqual({
      status: {$eq: true},
    });
  });
});

// ─── Pipeline builder tests ───────────────────────────────────────────────────

describe("buildPipeline", () => {
  it("builds a basic bar chart pipeline for simple source", () => {
    const pipeline = buildPipeline(baseConfig, defaultOptions, mockSimpleSource);
    expect(pipeline.length).toBeGreaterThan(0);

    // Should have $group stage
    const groupStage = pipeline.find((s) => "$group" in s);
    expect(groupStage).toBeDefined();

    // Should have $limit
    const limitStage = pipeline.find((s) => "$limit" in s);
    expect(limitStage).toBeDefined();
    expect((limitStage as any).$limit).toBe(100);
  });

  it("prepends enriched source base pipeline", () => {
    const config: ChartConfig = {...baseConfig, dataSource: "TestEnriched"};
    const pipeline = buildPipeline(config, defaultOptions, mockEnrichedSource);

    const firstStage = pipeline[0];
    expect(firstStage).toEqual({$match: {active: true}});
  });

  it("adds $addFields for dateTrunc on x axis", () => {
    const config: ChartConfig = {
      ...baseConfig,
      x: {dateTrunc: "month", field: "created"},
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const addFieldsStage = pipeline.find(
      (s) => "$addFields" in s && (s as any).$addFields.__trunc_created
    );
    expect(addFieldsStage).toBeDefined();
    expect((addFieldsStage as any).$addFields.__trunc_created).toMatchObject({
      $dateTrunc: {date: "$created", unit: "month"},
    });
  });

  it("groups by color dimension when color is set", () => {
    const config: ChartConfig = {
      ...baseConfig,
      color: {field: "status"},
      x: {field: "email"},
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const groupStage = pipeline.find((s) => "$group" in s) as any;
    expect(groupStage.$group._id.color).toBe("$status");
  });

  it("handles multiple y axes", () => {
    const config: ChartConfig = {
      ...baseConfig,
      y: [
        {aggregation: "sum", field: "amount"},
        {aggregation: "count", field: "count"},
      ],
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const groupStage = pipeline.find((s) => "$group" in s) as any;
    expect(groupStage.$group.y0).toBeDefined();
    expect(groupStage.$group.y1).toBeDefined();
  });

  it("builds countDistinct via $addToSet + $size", () => {
    const config: ChartConfig = {
      ...baseConfig,
      y: {aggregation: "countDistinct", field: "email"},
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const groupStage = pipeline.find((s) => "$group" in s) as any;
    expect(groupStage.$group.y).toEqual({$addToSet: "$email"});

    // Should have a $addFields after $group to compute $size
    const groupIdx = pipeline.indexOf(groupStage);
    const sizeStage = pipeline[groupIdx + 1] as any;
    expect(sizeStage.$addFields?.y).toEqual({$size: "$y"});
  });

  it("includes $match stage when filters are provided", () => {
    const config: ChartConfig = {
      ...baseConfig,
      filters: [{field: "status", type: "eq", value: "active"}],
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const matchStage = pipeline.find((s) => "$match" in s) as any;
    expect(matchStage).toBeDefined();
    expect(matchStage.$match.$and[0]).toEqual({status: {$eq: "active"}});
  });

  it("applies custom sort", () => {
    const config: ChartConfig = {
      ...baseConfig,
      sort: {direction: "desc", field: "y"},
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const sortStage = pipeline.find((s) => "$sort" in s) as any;
    expect(sortStage.$sort.y).toBe(-1);
  });

  it("adds $setWindowFields for runningTotal when supportsWindowFields=true", () => {
    const config: ChartConfig = {
      ...baseConfig,
      y: {aggregation: "runningTotal", field: "amount"},
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const windowStage = pipeline.find((s) => "$setWindowFields" in s);
    expect(windowStage).toBeDefined();
  });

  it("throws when runningTotal used without MongoDB 5+ support", () => {
    const config: ChartConfig = {
      ...baseConfig,
      y: {aggregation: "runningTotal", field: "amount"},
    };
    const options = {...defaultOptions, supportsWindowFields: false};
    expect(() => buildPipeline(config, options, mockSimpleSource)).toThrow(
      "runningTotal and rank aggregations require MongoDB 5+"
    );
  });

  it("adds $setWindowFields for rank", () => {
    const config: ChartConfig = {
      ...baseConfig,
      y: {aggregation: "rank", field: "amount"},
    };
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const windowStage = pipeline.find((s) => "$setWindowFields" in s) as any;
    expect(windowStage).toBeDefined();
    const outputKey = Object.keys(windowStage.$setWindowFields.output)[0];
    expect(outputKey).toBe("y_rank");
  });

  it("throws when field not in allowedFields for simple source", () => {
    const config: ChartConfig = {
      ...baseConfig,
      x: {field: "password"},
    };
    expect(() => buildPipeline(config, defaultOptions, mockSimpleSource)).toThrow(
      "Field 'password' is not allowed"
    );
  });

  it("caps limit at MAX_LIMIT (5000)", () => {
    const config: ChartConfig = {...baseConfig, limit: 99999};
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const limitStage = pipeline.find((s) => "$limit" in s) as any;
    expect(limitStage.$limit).toBe(5000);
  });

  it("uses default limit of 1000 when not specified", () => {
    const config: ChartConfig = {...baseConfig, limit: undefined};
    const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
    const limitStage = pipeline.find((s) => "$limit" in s) as any;
    expect(limitStage.$limit).toBe(1000);
  });

  it("includes all date trunc units", () => {
    const units = ["year", "quarter", "month", "week", "day", "hour"] as const;
    for (const unit of units) {
      const config: ChartConfig = {
        ...baseConfig,
        x: {dateTrunc: unit, field: "created"},
      };
      const pipeline = buildPipeline(config, defaultOptions, mockSimpleSource);
      const addFieldsStage = pipeline.find(
        (s) => "$addFields" in s && (s as any).$addFields.__trunc_created
      ) as any;
      expect(addFieldsStage.$addFields.__trunc_created.$dateTrunc.unit).toBe(unit);
    }
  });

  it("builds all aggregation types except window fields", () => {
    const aggs = ["count", "sum", "avg", "min", "max", "countDistinct"] as const;
    for (const aggregation of aggs) {
      const config: ChartConfig = {
        ...baseConfig,
        y: {aggregation, field: "amount"},
      };
      // Should not throw
      expect(() => buildPipeline(config, defaultOptions, mockSimpleSource)).not.toThrow();
    }
  });
});
