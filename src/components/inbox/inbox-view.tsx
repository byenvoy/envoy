"use client";

import { useState, useEffect, useCallback, useRef, type RefCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConversationList } from "./conversation-list";
import { ThreadPanel } from "./thread-view";
import { DraftPanel } from "./ticket-detail";
import { InboxFilters } from "./inbox-filters";
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

  return (
    <div className="flex h-full flex-col">
      {showNudge && (
        <div className="flex items-center justify-between border-b border-ai-accent/30 bg-ai-light px-4 py-2.5">
          <p className="font-body text-sm text-text-primary">
            Set up Autopilot topics to start calibration — every email you handle teaches it.{" "}
            <a
              href="/autopilot"
              className="font-semibold text-ai-accent underline decoration-ai-accent/40 hover:decoration-ai-accent"
            >
              Get started
            </a>
          </p>
          <button
            onClick={() => {
              setNudgeDismissed(true);
              localStorage.setItem("autopilot-nudge-dismissed", "1");
            }}
            className="ml-4 shrink-0 rounded p-1 text-text-secondary hover:text-text-primary"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
      {/* Mobile: back button */}
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
          className={`flex h-full min-w-0 flex-1 ${
            !mobileShowDetail ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Thread panel */}
          <div className={`h-full min-w-0 flex-1 overflow-y-auto p-5 ${showRightPanel ? "border-r border-border" : ""}`}>
            <ThreadPanel
              conversation={detailData.conversation}
              messages={detailData.messages}
              onClose={handleClose}
              closing={closing}
            />
          </div>
          {/* Right panel — customer context + draft */}
          {showRightPanel && (
            <div className="hidden h-full w-[380px] flex-shrink-0 overflow-y-auto md:block">
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
