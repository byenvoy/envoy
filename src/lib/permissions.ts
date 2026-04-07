import { NextResponse } from "next/server";

export type Role = "owner" | "agent";

// ---------------------------------------------------------------------------
// Feature access — the single source of truth for what each role can do
// ---------------------------------------------------------------------------

/** Features that only owners can access. Everything else is open to all roles. */
const OWNER_ONLY_FEATURES = [
  "dashboard",
  "billing",
  "api-keys",
  "model",
  "tone",
  "team",
] as const;

export type Feature = (typeof OWNER_ONLY_FEATURES)[number];

export function canAccessFeature(role: Role, feature: Feature): boolean {
  if (!OWNER_ONLY_FEATURES.includes(feature)) return true;
  return role === "owner";
}

// ---------------------------------------------------------------------------
// Page access — controls redirects and nav visibility
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
}

const ALL_NAV_ITEMS: (NavItem & { ownerOnly: boolean })[] = [
  { href: "/dashboard", label: "Dashboard", ownerOnly: true },
  { href: "/inbox", label: "Inbox", ownerOnly: false },
  { href: "/autopilot", label: "Autopilot", ownerOnly: false },
  { href: "/knowledge-base", label: "Knowledge Base", ownerOnly: false },
  { href: "/settings", label: "Settings", ownerOnly: false },
];

export function getNavItems(role: Role): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => !item.ownerOnly || role === "owner").map(
    ({ href, label }) => ({ href, label })
  );
}

/** Owner-only page paths — used for page-level redirects. */
const OWNER_ONLY_PAGES = ["/dashboard"];

export function canAccessPage(role: Role, path: string): boolean {
  return !OWNER_ONLY_PAGES.some((p) => path.startsWith(p)) || role === "owner";
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Returns a 403 response if the user is not an owner, or null if they are.
 * Usage in API routes:
 *   const denied = requireOwner(role);
 *   if (denied) return denied;
 */
export function requireOwner(role: string): NextResponse | null {
  if (role === "owner") return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
