const conversations = [
  {
    id: "1",
    name: "Sarah C.",
    subject: "Refund for order #3190",
    time: "2m",
    status: "open" as const,
    selected: true,
  },
  {
    id: "2",
    name: "Marcus J.",
    subject: "Return request for blue jacket",
    time: "18m",
    status: "open" as const,
    selected: false,
  },
  {
    id: "3",
    name: "Emily R.",
    subject: "Size guide question",
    time: "1h",
    status: "waiting" as const,
    selected: false,
  },
  {
    id: "4",
    name: "David P.",
    subject: "Bulk order pricing",
    time: "3h",
    status: "open" as const,
    selected: false,
  },
  {
    id: "5",
    name: "Norton M.",
    subject: "Warranty claim for item #2219",
    time: "5h",
    status: "waiting" as const,
    selected: false,
  },
  {
    id: "6",
    name: "Tom N.",
    subject: "Wrong color received",
    time: "1d",
    status: "closed" as const,
    selected: false,
  },
  {
    id: "7",
    name: "Lisa M.",
    subject: "International shipping rates",
    time: "1d",
    status: "closed" as const,
    selected: false,
  },
  {
    id: "8",
    name: "James W.",
    subject: "Gift wrapping options?",
    time: "2d",
    status: "closed" as const,
    selected: false,
  },
  {
    id: "9",
    name: "Priya S.",
    subject: "Subscription billing issue",
    time: "2d",
    status: "open" as const,
    selected: false,
  },
  {
    id: "10",
    name: "Carlos R.",
    subject: "Exchange for different size",
    time: "3d",
    status: "closed" as const,
    selected: false,
  },
];

const threadMessages = [
  {
    id: "m1",
    sender: "Sarah C.",
    initials: "SC",
    isOutbound: false,
    collapsed: false,
    preview: "",
    body: `Hi there,

I'd like to request a refund for order #3190. The jacket I received has a broken zipper and a small tear near the collar. I've attached photos.

Can you let me know how to proceed?

Thanks,
Sarah`,
    time: "Apr 5, 2026 at 10:32 AM",
  },
];

const draftContent = `Hi Sarah,

I'm sorry to hear about the defective jacket. Since order #3190 is within our 30-day return window, I've gone ahead and initiated a full refund to your original payment method.

You should see the refund within 3-5 business days. No need to return the damaged item.

Best,
Brooke`;

const chunks = [
  { label: "returns-policy", similarity: "96%" },
  { label: "refund-faq", similarity: "91%" },
  { label: "warranty-info", similarity: "84%" },
];

const statusStyles = {
  open: "bg-ai-accent-light text-ai-accent",
  waiting: "bg-success-light text-primary",
  closed: "bg-surface-alt text-text-secondary",
};

const navItems = [
  { label: "Dashboard", active: false },
  { label: "Inbox", active: true },
  { label: "Autopilot", active: false },
  { label: "Knowledge Base", shortLabel: "KB", active: false },
  { label: "Settings", active: false },
];

const statusFilters = [
  { label: "All", value: "all", count: 10, active: true },
  { label: "Open", value: "open", count: 4, active: false },
  { label: "Waiting", value: "waiting", count: 2, active: false },
  { label: "Closed", value: "closed", count: 4, active: false },
];

export function DemoInbox() {
  return (
    <div className="overflow-hidden bg-surface">
      {/* Nav bar — hidden on mobile where the scaled view has its own */}
      <nav className="hidden border-b border-border bg-surface sm:block">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="mr-4 font-display text-[15px] font-bold tracking-tight text-primary">
              envoyer
            </span>
            <div className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => (
                <span
                  key={item.label}
                  className={`rounded-lg px-3 py-1.5 font-display text-sm font-medium ${
                    item.active
                      ? "bg-success-light text-primary"
                      : "text-text-secondary"
                  }`}
                >
                  {"shortLabel" in item ? (
                    <>
                      <span className="sm:hidden">{item.shortLabel}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </>
                  ) : (
                    item.label
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 sm:flex">
              <span className="font-mono text-xs text-text-secondary">
                Search...
              </span>
              <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-white">
              BN
            </div>
          </div>
        </div>
      </nav>

      {/* Full three-column layout, scaled down on mobile */}
      <div className="overflow-hidden sm:hidden" style={{ height: 236 }}>
        <div className="origin-top-left scale-[0.33]" style={{ width: 1080 }}>
          {/* Scaled nav */}
          <nav className="border-b border-border bg-surface">
            <div className="flex h-14 items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <span className="mr-4 font-display text-[15px] font-bold tracking-tight text-primary">
                  envoyer
                </span>
                <div className="flex items-center gap-1">
                  {navItems.map((item) => (
                    <span
                      key={item.label}
                      className={`rounded-lg px-3 py-1.5 font-display text-sm font-medium ${
                        item.active
                          ? "bg-success-light text-primary"
                          : "text-text-secondary"
                      }`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5">
                  <span className="font-mono text-xs text-text-secondary">
                    Search...
                  </span>
                  <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px]">
                    ⌘K
                  </kbd>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-white">
                  BN
                </div>
              </div>
            </div>
          </nav>
          <div className="flex" style={{ height: 620 }}>
          {/* Mobile-scaled: conversation list */}
          <div className="flex w-[240px] flex-shrink-0 flex-col border-r border-border bg-surface">
            <div className="flex-shrink-0 border-b border-border p-3">
              <div className="space-y-3">
                <input
                  type="text"
                  readOnly
                  placeholder="Search..."
                  className="min-w-0 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary"
                />
                <div className="flex min-w-0 gap-0.5">
                  {statusFilters.map((filter) => (
                    <span
                      key={filter.value}
                      className={`inline-flex items-baseline gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 font-display text-[11px] font-medium tabular-nums ${
                        filter.active
                          ? "bg-primary text-white"
                          : "bg-surface text-text-secondary"
                      }`}
                    >
                      {filter.label}
                      {filter.count > 0 && (
                        <span className="text-[9px] opacity-50">
                          {filter.count}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="divide-y divide-border">
                {conversations.map((convo) => (
                  <div
                    key={convo.id}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      convo.selected ? "bg-success-light" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-sm font-semibold text-text-primary">
                        {convo.name}
                      </span>
                      <span className="flex-shrink-0 font-mono text-xs text-text-secondary">
                        {convo.time}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-text-primary">
                        {convo.subject}
                      </p>
                      {convo.status !== "open" && (
                        <span
                          className={`rounded px-1.5 py-0.5 font-display text-[10px] font-medium ${statusStyles[convo.status]}`}
                        >
                          {convo.status.charAt(0).toUpperCase() +
                            convo.status.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Mobile-scaled: thread panel */}
          <div className="flex min-w-0 flex-1 flex-col border-r border-border">
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-lg font-bold tracking-tight text-text-primary">
                    Refund for order #3190
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-secondary">
                      Close
                    </span>
                    <span className="rounded-full bg-success-light px-2.5 py-1 font-display text-[11px] font-semibold text-primary">
                      Open
                    </span>
                  </div>
                </div>
                <p className="mt-1 font-mono text-xs text-text-secondary">
                  Sarah C. &lt;sarah.chen@gmail.com&gt; &middot; 1 message
                </p>
              </div>
              <div className="divide-y divide-border">
                {threadMessages.map((msg) => (
                  <div key={msg.id} className="py-3">
                    <div className="flex gap-3">
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-white"
                        style={
                          msg.isOutbound
                            ? undefined
                            : { backgroundColor: "#7C6F64" }
                        }
                      >
                        {msg.isOutbound ? "E" : msg.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-semibold text-text-primary">
                            {msg.sender}
                          </span>
                          <span className="font-mono text-xs text-text-secondary">
                            {msg.time}
                          </span>
                        </div>
                        <div className="mt-2 whitespace-pre-line font-mono text-[13px] leading-relaxed text-text-primary">
                          {msg.body}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Mobile-scaled: draft panel */}
          <div className="w-[340px] flex-shrink-0 overflow-hidden bg-surface-alt">
            <div className="border-b border-border bg-surface">
              <div className="flex w-full items-center justify-between p-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-alt font-display text-[10px] font-bold text-text-secondary">
                    SC
                  </div>
                  <div>
                    <p className="font-display text-sm font-semibold text-text-primary">
                      Sarah C.
                    </p>
                    <p className="font-mono text-[11px] text-text-secondary">
                      3 orders &middot; $284.00
                    </p>
                  </div>
                </div>
                <span className="text-xs text-text-secondary">+</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display text-sm font-semibold">
                  <span className="inline-block h-2 w-2 rounded-full bg-ai-accent" />
                  <span className="text-text-primary">Draft</span>
                </div>
                <span className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary">
                  Copy
                </span>
              </div>
              <div className="rounded-lg border border-border bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-text-primary">
                <div className="whitespace-pre-line">{draftContent}</div>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  Sources
                </span>
                <span className="inline-flex shrink-0 items-center rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
                  Customer Data
                </span>
                {chunks.map((chunk) => (
                  <span
                    key={chunk.label}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ai-accent-light px-2 py-0.5 text-[10px] font-medium text-ai-accent"
                  >
                    {chunk.label}
                    <span className="opacity-60">{chunk.similarity}</span>
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <span className="flex-1 rounded-lg bg-primary px-4 py-2 text-center font-display text-sm font-semibold text-white">
                    Send
                  </span>
                  <span className="rounded-lg border border-primary px-3 py-2 font-display text-sm font-medium text-primary">
                    Send &amp; Close
                  </span>
                </div>
                <span className="rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-text-secondary">
                  Regenerate
                </span>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Desktop: Three-column layout */}
      <div className="hidden sm:flex" style={{ height: 620 }}>
        {/* Conversation list — mirrors inbox-view.tsx left column */}
        <div className="hidden w-[220px] flex-shrink-0 flex-col border-r border-border bg-surface sm:flex lg:w-[260px]">
          {/* Filters — mirrors inbox-filters.tsx */}
          <div className="flex-shrink-0 border-b border-border p-3">
            <div className="space-y-3">
              <input
                type="text"
                readOnly
                placeholder="Search..."
                className="min-w-0 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary"
              />
              <div className="flex min-w-0 gap-0.5">
                {statusFilters.map((filter) => (
                  <span
                    key={filter.value}
                    className={`inline-flex items-baseline gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 font-display text-[11px] font-medium tabular-nums ${
                      filter.active
                        ? "bg-primary text-white"
                        : "bg-surface text-text-secondary"
                    }`}
                  >
                    {filter.label}
                    {filter.count > 0 && (
                      <span className="text-[9px] opacity-50">
                        {filter.count}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Conversation items — mirrors conversation-list.tsx */}
          <div className="flex-1 overflow-hidden">
            <div className="divide-y divide-border">
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    convo.selected ? "bg-success-light" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-sm font-semibold text-text-primary">
                      {convo.name}
                    </span>
                    <span className="flex-shrink-0 font-mono text-xs text-text-secondary">
                      {convo.time}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-text-primary">
                      {convo.subject}
                    </p>
                    {convo.status !== "open" && (
                      <span
                        className={`rounded px-1.5 py-0.5 font-display text-[10px] font-medium ${statusStyles[convo.status]}`}
                      >
                        {convo.status.charAt(0).toUpperCase() +
                          convo.status.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Thread panel — mirrors thread-view.tsx */}
        <div
          className={`flex min-w-0 flex-1 flex-col border-r border-border`}
        >
          <div className="flex-1 overflow-y-auto p-5">
            {/* Thread header */}
            <div className="mb-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-bold tracking-tight text-text-primary">
                  Refund for order #3190
                </h2>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-secondary">
                    Close
                  </span>
                  <span className="rounded-full bg-success-light px-2.5 py-1 font-display text-[11px] font-semibold text-primary">
                    Open
                  </span>
                </div>
              </div>
              <p className="mt-1 font-mono text-xs text-text-secondary">
                Sarah C. &lt;sarah.chen@gmail.com&gt; &middot; 1 message
              </p>
            </div>

            {/* Messages — mirrors MessageRow in thread-view.tsx */}
            <div className="divide-y divide-border">
              {threadMessages.map((msg) => (
                <div key={msg.id} className="py-3">
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-white ${
                        msg.isOutbound ? "bg-primary" : ""
                      }`}
                      style={
                        msg.isOutbound
                          ? undefined
                          : { backgroundColor: "#7C6F64" }
                      }
                    >
                      {msg.isOutbound ? "E" : msg.initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Header: name + time */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-display text-sm font-semibold ${
                            msg.isOutbound
                              ? "text-primary"
                              : "text-text-primary"
                          }`}
                        >
                          {msg.sender}
                        </span>
                        <span className="font-mono text-xs text-text-secondary">
                          {msg.time}
                        </span>
                      </div>

                      {/* Collapsed preview or expanded body */}
                      {msg.collapsed ? (
                        <p className="mt-0.5 truncate text-sm text-text-secondary">
                          {msg.preview}
                        </p>
                      ) : (
                        <div className="mt-2 whitespace-pre-line font-mono text-[13px] leading-relaxed text-text-primary">
                          {msg.body}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Draft panel — mirrors ticket-detail.tsx */}
        <div className="hidden w-[340px] flex-shrink-0 overflow-hidden bg-surface-alt lg:block xl:w-[380px]">
          {/* Customer context card — mirrors CustomerContextCard */}
          <div className="border-b border-border bg-surface">
            <div className="flex w-full items-center justify-between p-4 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-alt font-display text-[10px] font-bold text-text-secondary">
                  SC
                </div>
                <div>
                  <p className="font-display text-sm font-semibold text-text-primary">
                    Sarah C.
                  </p>
                  <p className="font-mono text-[11px] text-text-secondary">
                    3 orders &middot; $284.00
                  </p>
                </div>
              </div>
              <span className="text-xs text-text-secondary">+</span>
            </div>
          </div>

          {/* Draft section */}
          <div className="flex flex-col gap-3 p-4">
            {/* Draft header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-sm font-semibold">
                <span className="inline-block h-2 w-2 rounded-full bg-ai-accent" />
                <span className="text-text-primary">Draft</span>
              </div>
              <span className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary">
                Copy
              </span>
            </div>

            {/* Draft body — matches real app: border + bg-surface, click to edit */}
            <div className="rounded-lg border border-border bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-text-primary">
              <div className="whitespace-pre-line">{draftContent}</div>
            </div>

            {/* Sources bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Sources
              </span>
              <span className="inline-flex shrink-0 items-center rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-primary">
                Customer Data
              </span>
              {chunks.map((chunk) => (
                <span
                  key={chunk.label}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ai-accent-light px-2 py-0.5 text-[10px] font-medium text-ai-accent"
                >
                  {chunk.label}
                  <span className="opacity-60">{chunk.similarity}</span>
                </span>
              ))}
            </div>

            {/* Action buttons — matches real DraftPanel */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <span className="flex-1 rounded-lg bg-primary px-4 py-2 text-center font-display text-sm font-semibold text-white">
                  Send
                </span>
                <span className="rounded-lg border border-primary px-3 py-2 font-display text-sm font-medium text-primary">
                  Send &amp; Close
                </span>
              </div>
              <span className="rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-text-secondary">
                Regenerate
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
