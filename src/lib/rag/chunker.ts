const SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". "];
const TARGET_CHARS = 2000; // ~500 tokens
const OVERLAP_CHARS = 200; // ~50 tokens

interface Chunk {
  content: string;
  tokenCount: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitOnSeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  // Re-attach separator to the beginning of each part (except the first)
  return parts.map((part, i) => (i === 0 ? part : separator + part));
}

function recursiveSplit(
  text: string,
  separatorIndex: number
): string[] {
  if (text.length <= TARGET_CHARS) {
    return [text];
  }

  if (separatorIndex >= SEPARATORS.length) {
    // Last resort: split by character count
    const pieces: string[] = [];
    for (let i = 0; i < text.length; i += TARGET_CHARS) {
      pieces.push(text.slice(i, i + TARGET_CHARS));
    }
    return pieces;
  }

  const separator = SEPARATORS[separatorIndex];
  const parts = splitOnSeparator(text, separator);

  if (parts.length === 1) {
    // Separator not found, try next one
    return recursiveSplit(text, separatorIndex + 1);
  }

  // Recursively split any oversized parts with the next separator
  const splits: string[] = [];
  for (const part of parts) {
    if (part.length > TARGET_CHARS) {
      splits.push(...recursiveSplit(part, separatorIndex + 1));
    } else {
      splits.push(part);
    }
  }

  return splits;
}

export function chunkText(text: string): Chunk[] {
  const rawParts = recursiveSplit(text.trim(), 0);

  // Merge small pieces up to target size
  const merged: string[] = [];
  let current = "";

  for (const part of rawParts) {
    if (current && current.length + part.length > TARGET_CHARS) {
      merged.push(current);
      current = part;
    } else {
      current += part;
    }
  }
  if (current) {
    merged.push(current);
  }

  // Add overlap from previous chunk's tail
  const chunks: Chunk[] = [];
  for (let i = 0; i < merged.length; i++) {
    let content = merged[i];
    if (i > 0 && OVERLAP_CHARS > 0) {
      const prevText = merged[i - 1];
      const overlap = prevText.slice(-OVERLAP_CHARS);
      content = overlap + content;
    }
    chunks.push({
      content: content.trim(),
      tokenCount: estimateTokens(content),
    });
  }

  return chunks.filter((c) => c.content.length > 0);
}
