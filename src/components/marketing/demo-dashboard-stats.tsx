const stats = [
  { label: "Open tickets", value: "12", color: "text-primary" },
  { label: "Approval rate", value: "94%", color: "text-primary" },
  { label: "Cost this month", value: "$18.42", color: "text-ai-accent" },
  { label: "Drafts generated", value: "847", color: "text-text-primary" },
];

export function DemoDashboardStats() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white p-6 text-center">
          <p
            className={`font-display text-3xl font-bold tracking-tight ${stat.color}`}
          >
            {stat.value}
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
