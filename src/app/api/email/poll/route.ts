import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pollConnection } from "@/lib/email/imap-poll";
import type { EmailConnection } from "@/lib/types/database";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Advisory lock to prevent concurrent poll runs
  const { data: lockResult } = await admin.rpc("try_advisory_lock", {
    lock_id: 73501, // arbitrary unique lock ID
  });

  if (!lockResult) {
    return NextResponse.json({ error: "Poll already in progress" }, { status: 409 });
  }

  try {
    const { data: connections } = await admin
      .from("email_connections")
      .select("*")
      .eq("status", "active");

    let polled = 0;
    let errors = 0;
    let ticketsCreated = 0;

    for (const conn of (connections ?? []) as EmailConnection[]) {
      try {
        const created = await pollConnection(conn);
        ticketsCreated += created;
        polled++;
      } catch (err) {
        console.error(`Poll error for connection ${conn.id}:`, err);
        errors++;
        await admin
          .from("email_connections")
          .update({
            status: "error",
            error_message: err instanceof Error ? err.message : "Unknown error",
          })
          .eq("id", conn.id);
      }
    }

    return NextResponse.json({ polled, errors, tickets_created: ticketsCreated });
  } finally {
    await admin.rpc("advisory_unlock", { lock_id: 73501 });
  }
}
