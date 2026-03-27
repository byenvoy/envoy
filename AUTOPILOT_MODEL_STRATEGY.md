# Autopilot Model Strategy

## Current Behavior

The autopilot pipeline uses two different models:

- **Draft generation**: Uses the org's preferred model (configured in settings — could be any supported model)
- **Gate calls** (classification, retrieval judge, validation, escalation): Hardcoded to `claude-haiku-4-5-20251001`

## Problem

This creates issues for bring-your-own-API-key deployments:

- A user who chooses GPT-4o and provides an OpenAI key would also need an Anthropic API key for the gate calls
- This is unexpected — the user configured one provider but needs two
- On self-hosted deployments, the operator needs to provision an Anthropic key regardless of their preferred model

## Options

### Option 1: Use the org's preferred model for everything

- Simplest for the user — one API key, one provider
- More expensive if they're using a premium model (e.g., Sonnet/Opus for classification tasks that Haiku handles fine)
- No provider mapping logic needed

### Option 2: Map each provider to its cheapest model for gates

Use the cheapest model from the same provider as the org's preferred model:

| Provider | Draft Model (user's choice) | Gate Model (auto-selected) |
|----------|---------------------------|---------------------------|
| Anthropic | Any (Haiku/Sonnet/Opus) | Haiku |
| OpenAI | Any (GPT-4o/4o Mini) | GPT-4o Mini |
| Google | Any (Gemini 2.5/2.0 Flash) | Gemini 2.0 Flash |
| Mistral | Any (Large/Small) | Mistral Small |
| DeepSeek | DeepSeek V3 | DeepSeek V3 |

- Keeps costs down while staying within the user's provider
- User only needs one API key
- Requires a provider-to-cheap-model mapping in code

### Option 3: Make gate model configurable per org

- Add a `gate_model` setting to organizations or autopilot settings
- Default to Haiku but let the user override
- Most flexible but adds UI complexity

## Recommendation

Option 2 is the best balance. Implement the provider-to-cheapest-model mapping. The mapping already exists implicitly in `SUPPORTED_MODELS` in `src/lib/rag/llm.ts` — just need a function that takes a model ID and returns the cheapest model from the same provider.

## Files to Change

- `src/lib/rag/llm.ts` — add `getCheapestModelForProvider(modelId: string): string` function
- `src/lib/autopilot/pipeline.ts` — use the new function instead of hardcoded Haiku
- `src/lib/autopilot/escalation.ts` — same
- `src/lib/email/generate-draft.ts` — pass org's preferred model, derive gate model from it
