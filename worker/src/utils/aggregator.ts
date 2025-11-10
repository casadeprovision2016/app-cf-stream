import type { AggregateEnvelope, IngestEvent } from "../env.js";

interface AggregateState {
  from: number;
  to: number;
  count: number;
  highPriority: number;
  tags: Map<string, number>;
  sample?: IngestEvent;
  batch: IngestEvent[];
  degraded: boolean;
}

export interface AggregateOptions {
  tenantId: string;
  streamId: string;
  topic: string;
  windowMs: number;
  maxBatch: number;
}

export class AggregateBuffer {
  private readonly opts: AggregateOptions;
  private state: AggregateState | undefined;

  constructor(opts: AggregateOptions) {
    this.opts = opts;
  }

  append(event: IngestEvent): AggregateEnvelope | null {
    const bucketStart = Math.floor(event.timestamp / this.opts.windowMs) * this.opts.windowMs;
    const bucketEnd = bucketStart + this.opts.windowMs;

    if (!this.state || bucketStart >= this.state.to) {
      const flushed = this.flush();
      this.state = {
        from: bucketStart,
        to: bucketEnd,
        count: 0,
        highPriority: 0,
        tags: new Map(),
        sample: undefined,
        batch: [],
        degraded: false,
      };
      if (flushed) return flushed;
    }

    if (!this.state) return null; // type guard

    this.state.count += 1;
    if (event.importance === "high") this.state.highPriority += 1;

    if (!this.state.sample) this.state.sample = event;

    if (event.tags) {
      for (const [key, value] of Object.entries(event.tags)) {
        const tagKey = `${key}:${value}`;
        this.state.tags.set(tagKey, (this.state.tags.get(tagKey) ?? 0) + 1);
      }
    }

    if (this.state.batch.length < this.opts.maxBatch) {
      this.state.batch.push(event);
    } else {
      this.state.degraded = true;
    }

    return null;
  }

  flush(now: number = Date.now()): AggregateEnvelope | null {
    if (!this.state) return null;

    if (this.state.count === 0) {
      this.state = undefined;
      return null;
    }

    if (now < this.state.to && this.state.count > 0 && !this.state.degraded && this.state.batch.length < this.opts.maxBatch) {
      return null;
    }

    const tags: Record<string, number> = {};
    for (const [key, value] of this.state.tags.entries()) {
      tags[key] = value;
    }

    const envelope: AggregateEnvelope = {
      tenantId: this.opts.tenantId,
      streamId: this.opts.streamId,
      topic: this.opts.topic,
      window: { from: this.state.from, to: this.state.to },
      mode: this.state.degraded ? "aggregated" : "full",
      metrics: {
        count: this.state.count,
        highPriority: this.state.highPriority,
        tags,
      },
      sample: this.state.sample,
      batch: this.state.degraded ? [] : this.state.batch,
    };

    this.state = undefined;
    return envelope;
  }
}
