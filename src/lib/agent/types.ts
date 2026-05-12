import type { MatchedChunk } from "@/lib/db/helpers";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

/** A KB chunk with its source page URL resolved. */
export interface RetrievedChunk extends MatchedChunk {
  source_url?: string;
}

/**
 * Per-request context passed to every tool call. Never derived from
 * model input — multi-tenancy and identity are enforced here.
 */
export interface AgentContext {
  orgId: string;
  conversationId: string;
  customerEmail: string;
  customerName: string | null;
  /** Accumulates chunks across multiple search_knowledge_base calls. */
  retrievedChunks: RetrievedChunk[];
  /** Set on first lookup_shopify_context call. */
  customerContext: ShopifyCustomerContext | null;
  /** Set when submit_analysis is called; signals loop termination. */
  analysis: AgentAnalysis | null;
  /** Telemetry aggregation across the loop. */
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * The structured verdict the agent emits via the submit_analysis tool.
 * Downstream code reads this to populate the autopilot evaluation row
 * and decide auto-send.
 */
export interface AgentAnalysis {
  category: string;
  autopilotTopicId: string | null;
  autopilotConfidence: number | null;
  autopilotReasoning: string | null;
  escalationFlag: boolean;
  escalationReason: string | null;
  /** Short guidance the agent writes for the draft-reply phase. */
  draftInstructions: string;
}
