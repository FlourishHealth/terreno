import type {ScoreRecord, ScoreSink, TraceRecord, TraceSink} from "./types";

export class MemoryTraceSink implements TraceSink {
  readonly traces: TraceRecord[] = [];

  export = async (trace: TraceRecord): Promise<void> => {
    this.traces.push(trace);
  };
}

export class MemoryScoreSink implements ScoreSink {
  readonly scores: ScoreRecord[] = [];

  export = async (score: ScoreRecord): Promise<void> => {
    this.scores.push(score);
  };
}
