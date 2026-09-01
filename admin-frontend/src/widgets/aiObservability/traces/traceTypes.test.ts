import {describe, expect, it} from "bun:test";
import {
  durationBarPercent,
  flattenSpans,
  selectedSensitiveCount,
  type TraceListItem,
  type TraceSpanNode,
  unwrapTraceList,
} from "./traceTypes";

const span = (id: string, children: TraceSpanNode[] = []): TraceSpanNode => ({
  children,
  id,
  kind: "CHAIN",
  name: id,
  startedAt: "2026-09-01T12:00:00.000Z",
  status: "ok",
});

describe("traceTypes helpers", () => {
  it("unwraps a paginated list without losing more and total", () => {
    const listed = unwrapTraceList({
      data: [{id: "a"} as TraceListItem],
      limit: 20,
      more: true,
      page: 1,
      total: 40,
    });
    expect(listed.more).toBe(true);
    expect(listed.total).toBe(40);
    expect(listed.data[0].id).toBe("a");
  });

  it("counts selected sensitive traces", () => {
    const traces = [
      {id: "a", sensitive: true},
      {id: "b", sensitive: false},
    ] as TraceListItem[];
    expect(selectedSensitiveCount(traces, ["a", "b"])).toBe(1);
  });

  it("flattens nested spans with depth", () => {
    const rows = flattenSpans([span("root", [span("child")])]);
    expect(rows.map((row) => [row.span.id, row.depth])).toEqual([
      ["root", 0],
      ["child", 1],
    ]);
  });

  it("keeps a visible duration bar for short spans", () => {
    expect(durationBarPercent(1, 100)).toBe(4);
    expect(durationBarPercent(50, 100)).toBe(50);
  });
});
