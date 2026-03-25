"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConversationList } from "./conversation-list";
import { ThreadPanel } from "./thread-view";
import { DraftPanel } from "./ticket-detail";
import { InboxFilters } from "./inbox-filters";
import type { Conversation, Message, Draft } from "@/lib/types/database";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

interface InboxViewProps {
  conversations: Conversation[];
  statusCounts: Record<string, number>;
}

interface ConversationDetailData {
  conversation: Conversation;
  messages: Message[];
  draft: Draft | null;
  shopifyCustomer: ShopifyCustomerContext | null;
}

export function InboxView({ conversations, statusCounts }: InboxViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const [detailData, setDetailData] = useState<ConversationDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const fetchDetail = useCallback(async (conversationId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
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

  function handleSelectConversation(conversationId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", conversationId);
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

  // Auto-select first conversation on desktop when list changes
  useEffect(() => {
    if (conversations.length > 0 && window.innerWidth >= 768) {
      const currentStillExists = selectedId && conversations.some((c) => c.id === selectedId);
      if (!currentStillExists) {
        handleSelectConversation(conversations[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const hasPendingDraft = detailData?.draft && detailData.draft.status === "pending";
  const hasShopifyCustomer = detailData?.shopifyCustomer && (detailData.shopifyCustomer.customer || detailData.shopifyCustomer.recent_orders?.length);
  const showRightPanel = hasPendingDraft || hasShopifyCustomer;

  return (
    <div className="flex h-full">
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
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelectConversation}
          />
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
            />
          </div>
          {/* Right panel — customer context + draft */}
          {showRightPanel && (
            <div className="hidden h-full w-[380px] flex-shrink-0 overflow-y-auto md:block">
              <DraftPanel
                conversation={detailData.conversation}
                draft={hasPendingDraft ? detailData.draft! : null}
                shopifyCustomer={detailData.shopifyCustomer}
                draftUsedCustomerData={!!detailData.draft?.customer_context}
                onRefresh={handleDetailRefresh}
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
          <div className="text-center">
            <p className="font-display text-sm font-medium text-text-secondary">
              Select a conversation to view
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
