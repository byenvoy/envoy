"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { NavBar } from "./nav-bar";
import { CommandPalette } from "./command-palette";
import { SubscriptionBanner } from "./subscription-banner";
import { LLMErrorBanner } from "./llm-error-banner";
import type { Role } from "@/lib/permissions";

interface ShellContext {
  setMobileNavContent: (content: React.ReactNode) => void;
  openCommandPalette: () => void;
  userName: string;
  userEmail: string;
  userRole: Role;
}

const ShellCtx = createContext<ShellContext | null>(null);
export function useShell() {
  return useContext(ShellCtx);
}

interface DashboardShellProps {
  userInitials: string;
  userName: string;
  userEmail: string;
  userRole: Role;
  subscriptionStatus?: string | null;
  llmErrorMessage?: string | null;
  children: React.ReactNode;
}

export function DashboardShell({ userInitials, userName, userEmail, userRole, subscriptionStatus, llmErrorMessage, children }: DashboardShellProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileNavContent, setMobileNavContent] = useState<React.ReactNode>(null);
  const pathname = usePathname();
  const isInbox = pathname.startsWith("/inbox");

  const togglePalette = useCallback(() => {
    setCommandPaletteOpen((prev) => !prev);
  }, []);

  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
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

  // Reset mobile nav content on route change
  useEffect(() => {
    setMobileNavContent(null);
  }, [pathname]);

  return (
    <ShellCtx.Provider value={{ setMobileNavContent, openCommandPalette, userName, userEmail, userRole }}>
      <div className={isInbox ? "flex h-dvh flex-col bg-surface" : "min-h-screen bg-surface"}>
        <NavBar
          userInitials={userInitials}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          onOpenCommandPalette={openCommandPalette}
          mobileContent={mobileNavContent}
        />
        {subscriptionStatus && <SubscriptionBanner status={subscriptionStatus} />}
        {llmErrorMessage && <LLMErrorBanner message={llmErrorMessage} />}
        <main className={isInbox ? "min-h-0 flex-1" : "mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8"}>
          {children}
        </main>
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          userRole={userRole}
        />
      </div>
    </ShellCtx.Provider>
  );
}
