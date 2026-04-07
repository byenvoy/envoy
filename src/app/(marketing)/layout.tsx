import Link from "next/link";
import { NavScrollScript } from "@/components/marketing/nav-scroll-script";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <nav className="sticky top-0 z-50 border-b border-transparent bg-surface/85 backdrop-blur-xl transition-colors [&.scrolled]:border-border">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-primary-dark"
          >
            envoyer
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="hidden px-2 py-2 font-body text-sm font-medium text-text-secondary transition-colors hover:text-text-primary sm:inline-flex"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="hidden px-2 py-2 font-body text-sm font-medium text-text-secondary transition-colors hover:text-text-primary sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-sm bg-primary px-5 py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>
      <NavScrollScript />
      {children}
    </div>
  );
}
