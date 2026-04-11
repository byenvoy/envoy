"use client";

import { useState, useEffect, useCallback, useRef, type RefCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConversationList } from "./conversation-list";
import { ThreadPanel } from "./thread-view";
import { DraftPanel } from "./ticket-detail";
import { InboxFilters } from "./inbox-filters";
import { StatusBadge } from "./status-badge";
import { useShell } from "@/components/dashboard/dashboard-shell";
import { MobileNavMenu } from "@/components/dashboard/nav-bar";
import type { Conversation, Message, Draft } from "@/lib/types/database";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

interface ConversationDetailData {
  conversation: Conversation;
  messages: Message[];
  draft: Draft | null;
  shopifyCustomer: ShopifyCustomerContext | null;
}

interface InboxViewProps {
  conversations: Conversation[];
  statusCounts: Record<string, number>;
  initialDetail: ConversationDetailData | null;
  hasMore: boolean;
  pageSize: number;
  showAutopilotNudge?: boolean;
}

export function InboxView({
  conversations,
  statusCounts,
  initialDetail,
  hasMore: initialHasMore,
  pageSize,
  showAutopilotNudge,
}: InboxViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSelectedId = searchParams.get("id") ?? initialDetail?.conversation.id ?? null;

  // Detail cache — avoids re-fetching previously viewed conversations
  const detailCache = useRef<Map<string, ConversationDetailData>>(new Map());

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detailData, setDetailData] = useState<ConversationDetailData | null>(initialDetail);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [extraConversations, setExtraConversations] = useState<Conversation[]>([]);
  const [nudgeDismissed, setNudgeDismissed] = useState(true);
  useEffect(() => {
    setNudgeDismissed(localStorage.getItem("autopilot-nudge-dismissed") === "1");
  }, []);

  // Seed cache with initial detail
  useEffect(() => {
    if (initialDetail) {
      detailCache.current.set(initialDetail.conversation.id, initialDetail);
    }
  }, [initialDetail]);

  const allConversations = [...conversations, ...extraConversations];

  // Infinite scroll — load more when sentinel enters viewport
  const loadingMoreRef = useRef(false);
  const sentinelRef: RefCallback<HTMLDivElement> = useCallback(
    (node) => {
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !loadingMoreRef.current) {
            handleLoadMore();
          }
        },
        { rootMargin: "200px" }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allConversations.length, hasMore]
  );

  const fetchDetail = useCallback(async (conversationId: string) => {
    // Check cache first
    const cached = detailCache.current.get(conversationId);
    if (cached) {
      setDetailData(cached);
      return;
    }

    setDetailLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) return;
      const data: ConversationDetailData = await res.json();
      detailCache.current.set(conversationId, data);
      setDetailData(data);
    } catch {
      // Ignore fetch errors
    } finally {
      setDetailLoading(false);
    }
  }, []);


  function handleSelectConversation(conversationId: string) {
    setSelectedId(conversationId);
    fetchDetail(conversationId);
    setMobileShowDetail(true);
    // Update URL without triggering server re-render
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", conversationId);
    window.history.replaceState(null, "", `/inbox?${params.toString()}`);
  }

  function handleBack() {
    setMobileShowDetail(false);
    setSelectedId(null);
    setDetailData(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    window.history.replaceState(null, "", `/inbox?${params.toString()}`);
  }

  function handleDetailRefresh() {
    if (selectedId) {
      // Invalidate cache and re-fetch
      detailCache.current.delete(selectedId);
      fetchDetail(selectedId);
    }
  }

  function handleConversationSent() {
    if (selectedId) {
      detailCache.current.delete(selectedId);
    }
    setSelectedId(null);
    setDetailData(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    window.history.replaceState(null, "", `/inbox?${params.toString()}`);
    router.refresh();
  }

  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (!selectedId) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/conversations/${selectedId}/close`, {
        method: "POST",
      });
      if (!res.ok) return;
      detailCache.current.delete(selectedId);
      setSelectedId(null);
      setDetailData(null);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("id");
      window.history.replaceState(null, "", `/inbox?${params.toString()}`);
      router.refresh();
    } finally {
      setClosing(false);
    }
  }

  async function handleLoadMore() {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      const status = searchParams.get("status");
      const search = searchParams.get("search");
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      params.set("offset", String(allConversations.length));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/conversations?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setExtraConversations((prev) => [...prev, ...data.conversations]);
      setHasMore(data.conversations.length === pageSize);
    } catch {
      // Ignore
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  // Auto-select first conversation on desktop when list changes
  useEffect(() => {
    if (allConversations.length > 0 && window.innerWidth >= 768) {
      const currentStillExists = selectedId && allConversations.some((c) => c.id === selectedId);
      if (!currentStillExists) {
        const firstId = allConversations[0].id;
        setSelectedId(firstId);
        fetchDetail(firstId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // Reset extra conversations when server list changes (filter switch)
  useEffect(() => {
    setExtraConversations([]);
    setHasMore(initialHasMore);
  }, [conversations, initialHasMore]);

  const hasPendingDraft = detailData?.draft && detailData.draft.status === "pending";
  const hasShopifyCustomer = detailData?.shopifyCustomer && (detailData.shopifyCustomer.customer || detailData.shopifyCustomer.recent_orders?.length);
  const showRightPanel = hasPendingDraft || hasShopifyCustomer;

  const showNudge = showAutopilotNudge && !nudgeDismissed;

  // Set contextual mobile nav bar content
  const shell = useShell();
  useEffect(() => {
    if (!shell) return;

    if (mobileShowDetail && detailData) {
      // Thread view: back + subject + status + close
      shell.setMobileNavContent(
        <InboxThreadMobileNav
          conversation={detailData.conversation}
          onBack={handleBack}
          onClose={handleClose}
          closing={closing}
        />
      );
    } else {
      // List view: hamburger + search input
      shell.setMobileNavContent(
        <InboxListMobileNav
          userName={shell.userName}
          userEmail={shell.userEmail}
          role={shell.userRole}
        />
      );
    }

    return () => shell.setMobileNavContent(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileShowDetail, detailData, closing]);

  return (
    <div className="flex h-full flex-col">
      {showNudge && (
        <div className="flex items-center justify-between bg-primary px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <svg className="h-4 w-4 shrink-0 text-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="font-body text-sm text-white">
              Set up Autopilot topics early to start calibration — every email you handle teaches it.
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <a
              href="/autopilot"
              className="rounded-full bg-white px-3.5 py-1 text-xs font-display font-semibold text-primary hover:bg-white/90 transition-colors"
            >
              Get started
            </a>
            <button
              onClick={() => {
                setNudgeDismissed(true);
                localStorage.setItem("autopilot-nudge-dismissed", "1");
              }}
              className="rounded p-1 text-white/60 hover:text-white"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1">

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
          <ConversationList
            conversations={allConversations}
            selectedId={selectedId}
            activeFilter={searchParams.get("status") ?? "open"}
            searchQuery={searchParams.get("search")}
            onSelect={handleSelectConversation}
          />
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-3">
              {loadingMore && (
                <p className="text-xs text-text-secondary">Loading...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Middle + Right columns */}
      {selectedId && detailData ? (
        <div
          className={`min-w-0 flex-1 overflow-y-auto md:overflow-hidden ${
            !mobileShowDetail ? "hidden md:flex" : "flex"
          } flex-col md:flex-row`}
        >
            {/* Thread panel */}
            <div className={`min-w-0 flex-1 overflow-y-auto md:h-full ${showRightPanel ? "md:border-r md:border-border" : ""}`}>
              <div className="p-4 md:p-5">
                <ThreadPanel
                  conversation={detailData.conversation}
                  messages={detailData.messages}
                  onClose={handleClose}
                  closing={closing}
                  hideMobileHeader
                />
              </div>
            </div>
            {/* Right panel — customer context + draft */}
            {showRightPanel && (
              <div className="border-t border-border md:border-t-0 h-auto md:h-full w-full md:w-[380px] flex-shrink-0 overflow-y-auto">
                <DraftPanel
                  key={detailData.conversation.id}
                  conversation={detailData.conversation}
                  draft={hasPendingDraft ? detailData.draft! : null}
                  shopifyCustomer={detailData.shopifyCustomer}
                  draftUsedCustomerData={!!detailData.draft?.customer_context}
                  onRefresh={handleDetailRefresh}
                  onSent={handleConversationSent}
                />
              </div>
            )}
        </div>
      ) : selectedId && detailLoading ? (
        <div className={`flex flex-1 items-center justify-center ${!mobileShowDetail ? "hidden md:flex" : "flex"}`}>
          <p className="text-sm text-text-secondary">Loading...</p>
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          {allConversations.length === 0 ? (
            <div className="text-center">
              {searchParams.get("search") ? (
                <>
                  <p className="font-display text-sm font-semibold text-text-primary">No results found</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    No conversations match &ldquo;{searchParams.get("search")}&rdquo;
                  </p>
                </>
              ) : (searchParams.get("status") ?? "open") === "open" ? (
                <>
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success-light">
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="font-display text-sm font-semibold text-text-primary">All caught up!</p>
                  <p className="mt-1 text-xs text-text-secondary">No open conversations need attention.</p>
                </>
              ) : (
                <p className="text-sm text-text-secondary">No conversations yet.</p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="font-display text-sm font-medium text-text-secondary">
                Select a conversation to view
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

/** Mobile nav for inbox list view: hamburger + title */
function InboxListMobileNav({ userName, userEmail, role }: { userName: string; userEmail: string; role?: string }) {
  return (
    <>
      <MobileNavMenu userName={userName} userEmail={userEmail} role={role as import("@/lib/permissions").Role} />
      <span className="ml-1 font-display text-sm font-semibold text-text-primary">Inbox</span>
    </>
  );
}

/** Mobile nav for thread detail view: back + subject + status + close */
function InboxThreadMobileNav({ conversation, onBack, onClose, closing }: {
  conversation: Conversation;
  onBack: () => void;
  onClose: () => void;
  closing: boolean;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="shrink-0 p-1 text-text-secondary hover:text-text-primary"
        aria-label="Back to list"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="min-w-0 flex-1 ml-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-sm font-semibold text-text-primary">
            {conversation.subject || "(no subject)"}
          </span>
          {conversation.status === "closed" && <StatusBadge status={conversation.status} />}
        </div>
        <p className="truncate font-mono text-[11px] text-text-secondary">
          {conversation.customer_email}
        </p>
      </div>
      {conversation.status !== "closed" && (
        <button
          onClick={onClose}
          disabled={closing}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-alt disabled:opacity-50"
        >
          {closing ? "..." : "Close"}
        </button>
      )}
    </>
  );
}
