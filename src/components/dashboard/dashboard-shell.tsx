"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { NavBar } from "./nav-bar";
import { CommandPalette } from "./command-palette";
import { SubscriptionBanner } from "./subscription-banner";

interface DashboardShellProps {
  userInitials: string;
  userName: string;
  userEmail: string;
  subscriptionStatus?: string | null;
  children: React.ReactNode;
}

export function DashboardShell({ userInitials, userName, userEmail, subscriptionStatus, children }: DashboardShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const pathname = usePathname();
  const isInbox = pathname.startsWith("/inbox");

  const togglePalette = useCallback(() => {
    setCommandPaletteOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        togglePalette();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePalette]);

  return (
    <div className={isInbox ? "flex h-screen flex-col bg-surface" : "min-h-screen bg-surface"}>
      <NavBar
        userInitials={userInitials}
        userName={userName}
        userEmail={userEmail}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />
      {subscriptionStatus && <SubscriptionBanner status={subscriptionStatus} />}
      <main className={isInbox ? "min-h-0 flex-1" : "mx-auto max-w-5xl px-4 py-8 sm:px-6"}>
        {children}
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
