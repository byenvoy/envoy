import type { ParsedMail } from "mailparser";

/**
 * Returns true if the parsed email looks like marketing, mailing-list, or
 * automated mail — anything we shouldn't bother drafting a reply to.
 *
 * High precision (very few false positives on real customer mail), modest
 * recall (~95% of bulk/automated). The headers checked here come from mail
 * infrastructure, not human users — a customer typing in Gmail simply does
 * not set them.
 */
export function isAutomatedEmail(parsed: ParsedMail): boolean {
  const headers = parsed.headers;
  if (!headers) return false;

  // Bulk / marketing senders are required to set this since Feb 2024 by
  // Gmail/Yahoo. Catches most legitimate marketing.
  if (headers.has("list-unsubscribe")) return true;

  // Mailing lists, GitHub digests, etc.
  const precedence = headers.get("precedence");
  if (typeof precedence === "string" && /^(bulk|list|junk)$/i.test(precedence.trim())) {
    return true;
  }

  // RFC 3834 — out-of-office, password resets, account verification, etc.
  const autoSubmitted = headers.get("auto-submitted");
  if (typeof autoSubmitted === "string" && /^auto/i.test(autoSubmitted.trim())) {
    return true;
  }

  return false;
}
