"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/autopilot", label: "Autopilot" },
  { href: "/knowledge-base", label: "Knowledge Base", shortLabel: "KB" },
  { href: "/settings", label: "Settings" },
];

interface NavBarProps {
  userInitials: string;
  userName: string;
  userEmail: string;
  onOpenCommandPalette: () => void;
}

export function NavBar({ userInitials, userName, userEmail, onOpenCommandPalette }: NavBarProps) {
  const pathname = usePathname();
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
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="mr-4 font-display text-[15px] font-bold tracking-tight text-primary"
          >
            envoyer
          </Link>
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
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
                  {"shortLabel" in item ? (
                    <>
                      <span className="sm:hidden">{item.shortLabel}</span>
                      <span className="hidden sm:inline">{item.label}</span>
                    </>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:border-text-secondary"
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              {userInitials}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-surface shadow-lg">
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
