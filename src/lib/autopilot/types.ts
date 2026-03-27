import type { AutopilotTopic, AutopilotOutcome } from "@/lib/types/database";
import type { ShopifyCustomerContext } from "@/lib/types/shopify";

export interface TopicClassificationResult {
  passed: boolean;
  topicId: string | null;
  topicName: string | null;
  confidence: number;
  embeddingSimilarity: number | null;
  reasoning: string;
}

export interface RetrievalJudgmentResult {
  passed: boolean;
  confidence: number;
  reasoning: string;
}

export interface ValidationCheck {
  pass: boolean;
  note: string;
}

export interface ValidationResult {
  passed: boolean;
  confidence: number;
  checks: {
    responsiveness: ValidationCheck;
    accuracy: ValidationCheck;
    scope: ValidationCheck;
    completeness: ValidationCheck;
  };
  reasoning: string;
}

export interface AutopilotPipelineParams {
  orgId: string;
  conversationId: string;
  draftId: string;
  customerMessage: string;
  conversationHistory?: { role: "customer" | "agent"; content: string }[];
  draftContent: string;
  messageEmbedding: number[];
  chunks: { id: string; content: string; similarity: number; source_url?: string }[];
  customerContext: ShopifyCustomerContext | null;
  model: string;
  gate1Result?: TopicClassificationResult;
  activeTopics?: AutopilotTopic[];
}

export interface AutopilotPipelineResult {
  shouldAutoSend: boolean;
  isShadow: boolean;
  evaluationId: string;
  failureGate: number | null;
  outcome: AutopilotOutcome;
  topicMatch: { id: string; name: string; confidence: number } | null;
}

export type { AutopilotTopic };
