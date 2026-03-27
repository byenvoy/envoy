import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Atomically increment the daily send counter for an autopilot topic.
 * Replaces the Supabase `increment_autopilot_daily_sends` RPC function.
 */
export async function incrementAutopilotDailySends(topicId: string): Promise<void> {
  await db.execute(sql`
    UPDATE autopilot_topics
    SET daily_sends_today = daily_sends_today + 1
    WHERE id = ${topicId}
  `);
}
