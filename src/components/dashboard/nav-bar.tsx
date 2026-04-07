"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getNavItems, type Role } from "@/lib/permissions";

interface NavBarProps {
  userInitials: string;
  userName: string;
  userEmail: string;
  userRole: Role;
  onOpenCommandPalette: () => void;
  mobileContent?: React.ReactNode;
}

export function NavBar({ userInitials, userName, userEmail, userRole, onOpenCommandPalette, mobileContent }: NavBarProps) {
  const pathname = usePathname();
  const navItems = useMemo(() => getNavItems(userRole), [userRole]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <nav className="border-b border-border bg-surface">
      {/* Mobile: contextual content */}
      {mobileContent ? (
        <div className="flex h-12 items-center px-3 md:hidden">
          {mobileContent}
        </div>
      ) : (
        <MobileDefaultBar userName={userName} userEmail={userEmail} role={userRole} />
      )}
      {/* Desktop: always the full nav */}
      <div className="hidden md:flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Link
            href={userRole === "owner" ? "/dashboard" : "/inbox"}
            className="mr-4 font-display text-[15px] font-bold tracking-tight text-primary"
          >
            envoyer
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 font-display text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-success-light text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCommandPalette}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:border-text-secondary"
          >
            Search...
            <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
          {/* Avatar with dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              {userInitials}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-surface shadow-lg z-50">
                <div className="border-b border-border px-4 py-3">
                  <p className="font-display text-sm font-semibold text-text-primary">{userName}</p>
                  <p className="font-mono text-xs text-text-secondary">{userEmail}</p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={async () => {
                      await authClient.signOut();
                      window.location.href = "/login";
                    }}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

/** Reusable hamburger button + dropdown for mobile */
export function MobileNavMenu({ userName, userEmail, role }: { userName?: string; userEmail?: string; role?: Role }) {
  const pathname = usePathname();
  const navItems = useMemo(() => getNavItems(role ?? "agent"), [role]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
        aria-label="Navigation menu"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 5h12M3 9h12M3 13h12" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-52 rounded-lg border border-border bg-surface shadow-lg z-50">
          <div className="p-1.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2.5 font-display text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-success-light text-primary"
                      : "text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          {userName && (
            <div className="border-t border-border p-1.5">
              <div className="px-3 py-1.5">
                <p className="font-display text-xs font-medium text-text-primary">{userName}</p>
                {userEmail && <p className="font-mono text-[10px] text-text-secondary">{userEmail}</p>}
              </div>
              <button
                onClick={async () => {
                  await authClient.signOut();
                  window.location.href = "/login";
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Default mobile bar: hamburger + page title */
function MobileDefaultBar({ userName, userEmail, role }: { userName: string; userEmail: string; role: Role }) {
  const pathname = usePathname();
  const navItems = useMemo(() => getNavItems(role), [role]);

  const pageTitle = navItems.find(
    (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
  )?.label ?? (role === "owner" ? "Dashboard" : "Inbox");

  return (
    <div className="flex h-12 items-center gap-2 px-3 md:hidden">
      <MobileNavMenu userName={userName} userEmail={userEmail} role={role} />
      <span className="font-display text-sm font-semibold text-text-primary">{pageTitle}</span>
    </div>
  );
}
