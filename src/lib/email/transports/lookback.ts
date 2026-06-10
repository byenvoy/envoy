/**
 * Initial-sync lookback window. Controls how far back the first poll
 * fetches when a connection has no cursor yet (no historyId / lastUid).
 *
 * Defaults to 3 days, configurable via EMAIL_INITIAL_LOOKBACK_MINUTES.
 * For dev, set this small (e.g. 30) to keep test inboxes manageable.
 */
const DEFAULT_INITIAL_LOOKBACK_MINUTES = 60 * 24 * 3;
const DEFAULT_FALLBACK_LOOKBACK_MINUTES = 60 * 24;

export function getInitialLookbackMinutes(): number {
  const raw = process.env.EMAIL_INITIAL_LOOKBACK_MINUTES;
  if (!raw) return DEFAULT_INITIAL_LOOKBACK_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INITIAL_LOOKBACK_MINUTES;
  return Math.floor(parsed);
}

/**
 * Used when Gmail's history cursor expires (404 from /history) and we have
 * to refetch from scratch. Defaults to 1 day, configurable via
 * EMAIL_FALLBACK_LOOKBACK_MINUTES.
 */
export function getFallbackLookbackMinutes(): number {
  const raw = process.env.EMAIL_FALLBACK_LOOKBACK_MINUTES;
  if (!raw) return DEFAULT_FALLBACK_LOOKBACK_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FALLBACK_LOOKBACK_MINUTES;
  return Math.floor(parsed);
}

export function lookbackSinceDate(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export function lookbackUnixSeconds(minutes: number): number {
  return Math.floor(Date.now() / 1000) - minutes * 60;
}
