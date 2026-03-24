"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TicketListSidebar } from "./ticket-list";
import { ThreadPanel } from "./thread-view";
import { DraftPanel } from "./ticket-detail";
import { InboxFilters } from "./inbox-filters";
import type { Ticket, DraftReply } from "@/lib/types/database";
import type { ThreadMessage } from "./thread-view";

interface InboxViewProps {
  tickets: Ticket[];
  statusCounts: Record<string, number>;
}

interface TicketDetailData {
  ticket: Ticket;
  draft: DraftReply | null;
  threadMessages: ThreadMessage[];
}

export function InboxView({ tickets, statusCounts }: InboxViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const [detailData, setDetailData] = useState<TicketDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const fetchDetail = useCallback(async (ticketId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/detail`);
      if (!res.ok) return;
      const data = await res.json();
      setDetailData(data);
    } catch {
      // Ignore fetch errors
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
    } else {
      setDetailData(null);
    }
  }, [selectedId, fetchDetail]);

  function handleSelectTicket(ticketId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", ticketId);
    router.push(`/inbox?${params.toString()}`, { scroll: false });
    setMobileShowDetail(true);
  }

  function handleBack() {
    setMobileShowDetail(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    router.push(`/inbox?${params.toString()}`, { scroll: false });
  }

  function handleDetailRefresh() {
    if (selectedId) fetchDetail(selectedId);
  }

  // Auto-select first ticket on desktop when list changes (initial load, filter switch)
  useEffect(() => {
    if (tickets.length > 0 && window.innerWidth >= 768) {
      const currentStillExists = selectedId && tickets.some((t) => t.id === selectedId);
      if (!currentStillExists) {
        handleSelectTicket(tickets[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets]);

  return (
    <div className="flex h-full">
      {/* Mobile: back button when viewing detail */}
      {mobileShowDetail && selectedId && (
        <div className="fixed left-0 right-0 top-14 z-10 border-b border-border bg-surface p-3 md:hidden">
          <button
            onClick={handleBack}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            &larr; Back to list
          </button>
        </div>
      )}

      {/* Left column: conversation list */}
      <div
        className={`h-full w-full flex-shrink-0 border-r border-border bg-surface md:w-[260px] ${
          mobileShowDetail ? "hidden md:flex" : "flex"
        } flex-col`}
      >
        <div className="flex-shrink-0 border-b border-border p-3">
          <InboxFilters statusCounts={statusCounts} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <TicketListSidebar
            tickets={tickets}
            selectedId={selectedId}
            onSelect={handleSelectTicket}
          />
        </div>
      </div>

      {/* Middle + Right columns: thread + draft */}
      {selectedId && detailData ? (
        <div
          className={`flex h-full min-w-0 flex-1 ${
            !mobileShowDetail ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Thread panel */}
          <div className="h-full min-w-0 flex-1 overflow-y-auto border-r border-border p-5">
            <ThreadPanel
              ticket={detailData.ticket}
              threadMessages={detailData.threadMessages}
            />
          </div>
          {/* Draft panel */}
          <div className="hidden h-full w-[380px] flex-shrink-0 overflow-y-auto md:block">
            <DraftPanel
              ticket={detailData.ticket}
              draft={detailData.draft}
              onRefresh={handleDetailRefresh}
            />
          </div>
        </div>
      ) : selectedId && detailLoading ? (
        <div
          className={`flex flex-1 items-center justify-center ${
            !mobileShowDetail ? "hidden md:flex" : "flex"
          }`}
        >
          <p className="text-sm text-text-secondary">Loading...</p>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="text-center">
            <p className="font-display text-sm font-medium text-text-secondary">
              Select a conversation to view
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Choose a ticket from the list on the left
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
