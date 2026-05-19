import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_TOOLS, executeTool } from "./tools";
import type { Skill } from "@/lib/skills/types";
import type { AgentContext } from "./types";
import type { AutopilotTopicRow } from "@/lib/autopilot/types";

const MAX_ITERATIONS = 10;

interface ConversationMessage {
  role: "customer" | "agent";
  content: string;
}

interface AgentLoopInput {
  companyName: string;
  customerMessage: string;
  customerEmail: string;
  customerName: string | null;
  conversationHistory: ConversationMessage[];
  activeTopics: AutopilotTopicRow[];
}

interface AgentLoopArgs {
  client: Anthropic;
  model: string;
  skills: Skill[];
  input: AgentLoopInput;
  ctx: AgentContext;
}

/**
 * Run the analysis phase of the agent pipeline. Mutates `ctx`:
 * - retrievedChunks accumulates as the agent searches the KB
 * - customerContext is populated if the agent looks up Shopify
 * - analysis is set when the agent calls submit_analysis (loop exit)
 *
 * Uses prompt caching: the system prompt (skills list + tool definitions
 * are stable per org for many requests) is marked ephemeral so Anthropic
 * caches it across calls within the same org.
 */
export async function runAgentLoop(args: AgentLoopArgs): Promise<void> {
  const { client, model, skills, input, ctx } = args;

  const systemPrompt = buildSystemPrompt(input.companyName, skills);
  const initialUserMessage = buildInitialUserMessage(input);

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: initialUserMessage },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      // Cache the static system prompt across calls. Skills list and tool
      // definitions are stable for the lifetime of this skill version.
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: AGENT_TOOLS,
      messages,
    });

    ctx.usage.inputTokens += response.usage.input_tokens;
    ctx.usage.outputTokens += response.usage.output_tokens;

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") break;
    if (response.stop_reason === "max_tokens") {
      console.warn("Agent loop hit max_tokens; terminating");
      break;
    }
    if (response.stop_reason !== "tool_use") {
      console.warn(`Unexpected stop_reason: ${response.stop_reason}`);
      break;
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          ctx,
          skills
        ),
      }))
    );

    // Rolling cache breakpoint on the latest tool_result so the next
    // iteration reads the accumulated message history from cache instead
    // of re-tokenizing it. Strip prior breakpoints first — Anthropic
    // caps requests at 4 cache_control markers; we keep just the system
    // prompt + this one.
    for (const msg of messages) {
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        if (typeof block === "object" && block !== null && "cache_control" in block) {
          (block as { cache_control?: unknown }).cache_control = undefined;
        }
      }
    }
    const lastResult = toolResults[toolResults.length - 1];
    if (lastResult) {
      lastResult.cache_control = { type: "ephemeral" };
    }

    messages.push({ role: "user", content: toolResults });

    // Short-circuit: once submit_analysis is called we have everything we need
    if (ctx.analysis !== null) break;
  }
}

function buildSystemPrompt(companyName: string, skills: Skill[]): string {
  const skillList = skills
    .map((s) => `- **${s.name}**: ${s.description}`)
    .join("\n");

  return `You are Envoy, an AI support triage agent for ${companyName}.

Your job is to analyze an inbound customer support ticket and produce a structured verdict. You do NOT write the customer-facing reply — that happens in a separate phase after your verdict.

## Workflow

1. Read the \`triage\` skill first to understand the classification taxonomy and approach.
2. Decide what context you need. Use \`search_knowledge_base\` to find relevant policy/FAQ content. Use \`lookup_shopify_context\` if the ticket needs customer-specific data AND a Shopify integration is available.
3. Read relevant skills as needed (\`autopilot-verdict\` before judging autopilot eligibility, \`escalation\` before deciding to flag for human review, etc.).
4. Call \`submit_analysis\` with your verdict. This ends the analysis phase.

Be efficient — read each skill once, run needed searches, then submit. Do not retrieve context you won't use.

## Available skills

${skillList || "(No skills loaded)"}

## Critical constraints

- NEVER write the customer-facing draft in your text output. The \`draftInstructions\` field of \`submit_analysis\` is the only place to communicate with the draft-reply phase.
- NEVER invent facts. If you lack information, note it in \`draftInstructions\` so the drafter hedges appropriately.
- Call \`submit_analysis\` exactly once, as the final action.`;
}

function buildInitialUserMessage(input: AgentLoopInput): string {
  const parts: string[] = [];

  parts.push("# Inbound support ticket");
  parts.push("");
  parts.push(
    `**From:** ${input.customerEmail}${input.customerName ? ` (${input.customerName})` : ""}`
  );
  parts.push("");
  parts.push("## Message");
  parts.push("");
  parts.push(input.customerMessage);

  if (input.conversationHistory.length > 0) {
    parts.push("");
    parts.push("## Conversation history (oldest first)");
    parts.push("");
    for (const msg of input.conversationHistory) {
      parts.push(`**${msg.role}:** ${msg.content}`);
      parts.push("");
    }
  }

  parts.push("");
  parts.push("## Autopilot topics for this organization");
  parts.push("");
  if (input.activeTopics.length === 0) {
    parts.push(
      "(No active autopilot topics — autopilot will not apply to this ticket. Still submit an analysis with `autopilotTopicId` omitted.)"
    );
  } else {
    for (const topic of input.activeTopics) {
      parts.push(
        `- **${topic.name}** (id: \`${topic.id}\`, mode: ${topic.mode}, confidence bar: ${topic.confidenceThreshold})`
      );
      parts.push(`  ${topic.description}`);
    }
  }

  parts.push("");
  parts.push(
    "Analyze this ticket. Read the relevant skills, gather context via tools, then call `submit_analysis`."
  );

  return parts.join("\n");
}
