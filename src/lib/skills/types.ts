/**
 * A loaded skill — either a core skill from the filesystem or an org
 * overlay from the `org_skills` table.
 */
export interface Skill {
  name: string;
  description: string;
  body: string;
  source: "core" | "org";
}

/** Frontmatter parsed from a SKILL.md file. */
export interface SkillFrontmatter {
  name: string;
  description: string;
}
