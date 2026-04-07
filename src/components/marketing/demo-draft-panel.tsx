const draftContent = `Hi Sarah,

I'm sorry about the delay with order #4821. I've checked with our shipping team and it looks like the package was held at the carrier facility.

I've escalated this with FedEx and requested priority handling. You should see tracking movement within 24 hours.

If it doesn't arrive by Thursday, we'll ship a replacement overnight at no charge.

Best,
Support Team`;

const chunks = [
  { label: "shipping-policy" },
  { label: "returns-faq" },
  { label: "order-tracking" },
];

export function DemoDraftPanel() {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-ai-accent" />
          <span className="text-text-primary">Draft</span>
          <span className="font-mono text-[11px] font-normal text-text-secondary">
            AI Generated
          </span>
        </div>
        <span className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary">
          Copy
        </span>
      </div>

      {/* Draft body */}
      <div className="mt-4 rounded-lg border-l-[3px] border-l-ai-accent bg-ai-accent-light px-4 py-3 font-mono text-[13px] leading-[1.7] text-text-primary">
        <div className="whitespace-pre-line">{draftContent}</div>
      </div>

      {/* Sources */}
      <div className="mt-4 flex items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Sources
        </span>
        {chunks.map((chunk) => (
          <span
            key={chunk.label}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ai-accent-light px-2 py-0.5 text-[10px] font-medium text-ai-accent"
          >
            {chunk.label}
          </span>
        ))}
        <span className="inline-flex shrink-0 items-center rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
          Customer Data
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <span className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center font-display text-sm font-semibold text-white">
          Send &amp; Close
        </span>
        <span className="rounded-lg border border-primary px-3 py-2.5 font-display text-sm font-medium text-primary">
          Send
        </span>
        <span className="rounded-lg border border-border px-3 py-2.5 text-xs font-medium text-text-secondary">
          Regenerate
        </span>
      </div>
    </div>
  );
}
