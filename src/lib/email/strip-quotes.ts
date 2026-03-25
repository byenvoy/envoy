/**
 * Strips quoted reply text from an email body for display purposes.
 * Handles common email quoting patterns:
 * - Lines starting with ">" (standard quoting)
 * - "On <date> <person> wrote:" headers
 * - "From: / Sent: / To: / Subject:" Outlook-style headers
 * - "---------- Forwarded message ----------" Gmail forwards
 *
 * The full body_text is preserved in the database for RAG context.
 * This function is only used for UI display.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Stop at "On ... wrote:" pattern (Gmail/Apple Mail quote header)
    if (/^On .+ wrote:$/.test(trimmed)) {
      break;
    }

    // Stop at Outlook-style separator
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(trimmed)) {
      break;
    }

    // Stop at forwarded message separator
    if (/^-{5,}\s*Forwarded message\s*-{5,}$/i.test(trimmed)) {
      break;
    }

    // Stop at "From:" header block (Outlook quoting)
    if (/^From:\s+.+/.test(trimmed) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (/^(Sent|Date|To|Subject):\s+/.test(nextLine)) {
        break;
      }
    }

    // Skip lines starting with ">" (quoted text)
    if (trimmed.startsWith(">")) {
      continue;
    }

    result.push(line);
  }

  // Trim trailing whitespace/newlines from the result
  let end = result.length;
  while (end > 0 && result[end - 1].trim() === "") {
    end--;
  }

  return result.slice(0, end).join("\n");
}
