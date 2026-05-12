import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { orgSkills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseSkillFile } from "./parser";
import type { Skill } from "./types";

const CORE_SKILLS_DIR = join(process.cwd(), "src", "skills", "core");

/**
 * Load all core skills from the filesystem. Each subdirectory under
 * `src/skills/core/` must contain a SKILL.md file.
 */
async function loadCoreSkills(): Promise<Skill[]> {
  const entries = await readdir(CORE_SKILLS_DIR, { withFileTypes: true }).catch(() => []);
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(CORE_SKILLS_DIR, entry.name, "SKILL.md");
    try {
      const raw = await readFile(skillPath, "utf8");
      const { frontmatter, body } = parseSkillFile(raw);
      skills.push({
        name: frontmatter.name,
        description: frontmatter.description,
        body,
        source: "core",
      });
    } catch (err) {
      console.error(`Failed to load core skill at ${skillPath}:`, err);
    }
  }

  return skills;
}

/** Load all org-specific skill overlays for a given org from the database. */
async function loadOrgSkills(orgId: string): Promise<Skill[]> {
  const rows = await db
    .select()
    .from(orgSkills)
    .where(eq(orgSkills.orgId, orgId));

  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    body: row.body,
    source: "org" as const,
  }));
}

/**
 * Load the full skill set for an org: core skills + org overlays.
 * Org skills with the same name as a core skill replace the core version
 * (last-write-wins).
 */
export async function loadSkills(orgId: string): Promise<Skill[]> {
  const [core, org] = await Promise.all([loadCoreSkills(), loadOrgSkills(orgId)]);
  const byName = new Map<string, Skill>();
  for (const skill of core) byName.set(skill.name, skill);
  for (const skill of org) byName.set(skill.name, skill);
  return Array.from(byName.values());
}

/** Find a loaded skill by name. Used by the `read_skill` tool. */
export function findSkill(skills: Skill[], name: string): Skill | null {
  return skills.find((s) => s.name === name) ?? null;
}
