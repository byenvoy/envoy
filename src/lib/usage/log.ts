import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORTED_MODELS } from "@/lib/rag/llm";

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
  callType: "draft" | "classification";
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

  const admin = createAdminClient();
  const { error } = await admin.from("usage_logs").insert({
    org_id: orgId,
    draft_id: draftId ?? null,
    call_type: callType,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: estimatedCost,
  });

  if (error) {
    console.error("Failed to log usage:", error);
  }
}
