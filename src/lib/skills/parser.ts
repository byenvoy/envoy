import type { SkillFrontmatter } from "./types";

/**
 * Parse a SKILL.md file into frontmatter + body.
 *
 * Format:
 *   ---
 *   name: skill-name
 *   description: One-line description shown in the system prompt
 *   ---
 *   # Body markdown...
 *
 * Minimal — we only need `name` and `description`. No external YAML
 * dependency.
 */
export function parseSkillFile(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Skill file missing frontmatter (--- ... ---)");
  }

  const [, raw, body] = match;
  const fields: Record<string, string> = {};

  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) fields[key] = value;
  }

  if (!fields.name) throw new Error("Skill missing `name` in frontmatter");
  if (!fields.description) throw new Error("Skill missing `description` in frontmatter");

  return {
    frontmatter: { name: fields.name, description: fields.description },
    body: body.trim(),
  };
}
