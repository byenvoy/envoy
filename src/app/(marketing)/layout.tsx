import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <nav className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="font-display text-[15px] font-bold tracking-tight text-primary"
          >
            envoyer
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="font-display text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="font-display text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-1.5 font-display text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
