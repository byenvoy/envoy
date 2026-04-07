"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/autopilot", label: "Autopilot" },
  { href: "/knowledge-base", label: "Knowledge Base" },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) {
        setMobileNavOpen(false);
      }
    }
    if (menuOpen || mobileNavOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen, mobileNavOpen]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <nav className="border-b border-border bg-surface">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <div className="relative md:hidden" ref={mobileNavRef}>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
              aria-label="Navigation menu"
            >
              {mobileNavOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 5h12M3 9h12M3 13h12" />
                </svg>
              )}
            </button>
            {mobileNavOpen && (
              <div className="absolute left-0 top-full mt-2 w-52 rounded-lg border border-border bg-surface shadow-lg z-50">
                <div className="p-1.5">
                  {NAV_ITEMS.map((item) => {
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
              </div>
            )}
          </div>
          <Link
            href="/dashboard"
            className="mr-4 font-display text-[15px] font-bold tracking-tight text-primary"
          >
            envoyer
          </Link>
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
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
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:border-text-secondary"
          >
            Search...
            <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
          {/* Mobile search icon */}
          <button
            onClick={onOpenCommandPalette}
            className="flex sm:hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7.5" cy="7.5" r="4.5" />
              <path d="M11 11l3.5 3.5" />
            </svg>
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
