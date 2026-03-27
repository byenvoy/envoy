"use client";

import { useState, useEffect } from "react";

interface TopicMetric {
  topicId: string;
  topicName: string;
  total: number;
  gatePassRates: {
    gate1: number;
    gate2: number;
    gate3: number;
    gate4: number;
  };
  allGatesPassRate: number;
  autoSent: number;
  shadowTagged: number;
  approvedNoEditRate: number;
  approvedWithEditRate: number;
  discardedRate: number;
  avgEditDistance: number;
  shadowReviewedCount: number;
}

export function TopicMetrics() {
  const [metrics, setMetrics] = useState<TopicMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/autopilot/metrics");
        const data = await res.json();
        setMetrics(data.metrics ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading metrics...</p>;
  }

  if (metrics.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No autopilot data yet. Metrics will appear once emails are processed with active topics.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {metrics.map((m) => (
        <div
          key={m.topicId}
          className="rounded-lg border border-border bg-surface p-4"
        >
          <h3 className="font-display text-sm font-semibold text-text-primary">
            {m.topicName}
          </h3>
          <p className="mt-1 font-mono text-xs text-text-secondary">
            {m.total} emails evaluated &middot; {m.autoSent} auto-sent &middot;{" "}
            {m.shadowTagged} shadow-tagged
          </p>

          {/* Gate funnel */}
          <div className="mt-3 space-y-1.5">
            <GateBar label="Gate 1: Topic" rate={m.gatePassRates.gate1} />
            <GateBar label="Gate 2: Retrieval" rate={m.gatePassRates.gate2} />
            <GateBar label="Gate 3: Generation" rate={m.gatePassRates.gate3} />
            <GateBar label="Gate 4: Validation" rate={m.gatePassRates.gate4} />
          </div>

          {/* Shadow mode stats */}
          {m.shadowReviewedCount > 0 && (
            <div className="mt-3 rounded-md bg-surface-alt p-3">
              <p className="text-xs font-display font-medium text-text-primary">
                Shadow Mode Results ({m.shadowReviewedCount} reviewed)
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-mono text-lg font-semibold text-primary">
                    {(m.approvedNoEditRate * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-text-secondary">Approved as-is</p>
                </div>
                <div>
                  <p className="font-mono text-lg font-semibold text-ai">
                    {(m.approvedWithEditRate * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-text-secondary">Edited</p>
                </div>
                <div>
                  <p className="font-mono text-lg font-semibold text-error">
                    {(m.discardedRate * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-text-secondary">Discarded</p>
                </div>
              </div>
              {m.avgEditDistance > 0 && (
                <p className="mt-2 text-center font-mono text-xs text-text-secondary">
                  Avg edit distance: {m.avgEditDistance.toFixed(1)} words
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GateBar({ label, rate }: { label: string; rate: number }) {
  const pct = (rate * 100).toFixed(0);
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-text-secondary">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs text-text-secondary">
        {pct}%
      </span>
    </div>
  );
}
