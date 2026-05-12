/**
 * One-off: re-render the autopilot skill for a given org.
 *
 * Use when an autopilot topic was changed via raw SQL (bypassing the
 * API endpoints, which normally call syncAutopilotSkill on every CRUD).
 *
 * Run with:
 *   ORG_ID=<uuid> npx tsx scripts/resync-autopilot-skill.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { syncAutopilotSkill } from "../src/lib/skills/renderers/autopilot";

async function main() {
  const orgId = process.env.ORG_ID;
  if (!orgId) {
    console.error("Set ORG_ID env var");
    process.exit(1);
  }

  await syncAutopilotSkill(orgId, null);
  console.log(`Re-rendered autopilot skill for org ${orgId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
