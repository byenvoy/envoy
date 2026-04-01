/**
 * Parse search input into structured operators and free-text.
 *
 * Supported operators:
 *   from:jane@example.com
 *
 * Everything else is treated as free-text for full-text / ILIKE search.
 * Operators are case-insensitive.
 */

export interface ParsedSearch {
  from: string | null;
  freeText: string;
}

const OPERATOR_RE = /\b(from):(\S+)/gi;

export function parseSearch(raw: string): ParsedSearch {
  let from: string | null = null;

  const freeText = raw
    .replace(OPERATOR_RE, (_, op: string, value: string) => {
      switch (op.toLowerCase()) {
        case "from":
          from = value.toLowerCase();
          break;
      }
      return "";
    })
    .trim();

  return { from, freeText };
}
