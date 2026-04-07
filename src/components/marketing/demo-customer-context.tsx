export function DemoCustomerContext() {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-6">
      {/* Header */}
      <p className="font-display text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
        Customer
      </p>

      {/* Customer info */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface font-display text-xs font-bold text-text-secondary">
          SC
        </div>
        <div>
          <p className="font-display text-base font-bold text-text-primary">
            Sarah Chen
          </p>
          <p className="font-mono text-xs text-text-secondary">
            sarah.chen@gmail.com
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex gap-6">
        <div>
          <p className="font-display text-lg font-bold text-text-primary">3</p>
          <p className="font-mono text-[10px] text-text-secondary">orders</p>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-text-primary">
            $284
          </p>
          <p className="font-mono text-[10px] text-text-secondary">
            total spent
          </p>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-text-primary">
            2026
          </p>
          <p className="font-mono text-[10px] text-text-secondary">since</p>
        </div>
      </div>

      {/* Recent order */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-text-primary">
            Order #4821
          </span>
          <span className="rounded-full bg-ai-accent-light px-2 py-0.5 font-display text-[10px] font-medium text-ai-accent">
            In Transit
          </span>
        </div>
        <div className="mt-2 font-mono text-[11px] leading-relaxed text-text-secondary">
          Linen Blazer (M), Cotton Tee x2
          <br />
          $142.00 &middot; Placed Apr 1, 2026
          <br />
          Tracking: FDX-8891-4421
        </div>
      </div>

      {/* Source chip */}
      <div className="mt-3">
        <span className="inline-flex items-center rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
          Customer Data
        </span>
      </div>
    </div>
  );
}
