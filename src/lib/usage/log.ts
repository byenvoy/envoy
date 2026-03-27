import { db } from "@/lib/db";
import { usageLogs } from "@/lib/db/schema";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";
import type { UsageCallType } from "@/lib/types/database";

export async function logUsage({
  orgId,
  draftId,
  callType,
  model,
  inputTokens,
  outputTokens,
}: {
  orgId: string;
  draftId?: string;
  callType: UsageCallType;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const config = SUPPORTED_MODELS[model];
  const costPer1kInput = config?.costPer1kInput ?? 0;
  const costPer1kOutput = config?.costPer1kOutput ?? 0;
  const estimatedCost =
    (inputTokens / 1000) * costPer1kInput +
    (outputTokens / 1000) * costPer1kOutput;

  try {
    await db.insert(usageLogs).values({
      orgId,
      draftId: draftId ?? null,
      callType,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: String(estimatedCost),
    });
  } catch (error) {
    console.error("Failed to log usage:", error);
  }
}
