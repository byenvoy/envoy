-- Per-org API key storage (encrypted)
alter table organizations
  add column anthropic_api_key_encrypted text,
  add column openai_api_key_encrypted text,
  add column google_ai_key_encrypted text;
