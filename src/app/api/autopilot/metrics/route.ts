import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch all evaluations for the org in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: evaluations, error } = await supabase
    .from("autopilot_evaluations")
    .select("gate1_topic_id, gate1_topic_name, gate1_passed, gate2_passed, gate3_passed, gate4_passed, all_gates_passed, outcome, human_action, edit_distance")
    .eq("org_id", profile.org_id)
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate metrics per topic
  const topicMetrics = new Map<string, {
    topicId: string;
    topicName: string;
    total: number;
    gate1Pass: number;
    gate2Pass: number;
    gate3Pass: number;
    gate4Pass: number;
    allGatesPass: number;
    autoSent: number;
    shadowTagged: number;
    approvedNoEdit: number;
    approvedWithEdit: number;
    discarded: number;
    totalEditDistance: number;
    editDistanceCount: number;
  }>();

  for (const e of evaluations ?? []) {
    const key = e.gate1_topic_id ?? "unmatched";
    if (!topicMetrics.has(key)) {
      topicMetrics.set(key, {
        topicId: e.gate1_topic_id ?? "unmatched",
        topicName: e.gate1_topic_name ?? "Unmatched",
        total: 0,
        gate1Pass: 0,
        gate2Pass: 0,
        gate3Pass: 0,
        gate4Pass: 0,
        allGatesPass: 0,
        autoSent: 0,
        shadowTagged: 0,
        approvedNoEdit: 0,
        approvedWithEdit: 0,
        discarded: 0,
        totalEditDistance: 0,
        editDistanceCount: 0,
      });
    }

    const m = topicMetrics.get(key)!;
    m.total++;
    if (e.gate1_passed) m.gate1Pass++;
    if (e.gate2_passed) m.gate2Pass++;
    if (e.gate3_passed) m.gate3Pass++;
    if (e.gate4_passed) m.gate4Pass++;
    if (e.all_gates_passed) m.allGatesPass++;
    if (e.outcome === "auto_sent") m.autoSent++;
    if (e.outcome === "shadow_tagged") m.shadowTagged++;
    // Only count human actions from drafts where gate3 passed (not flagged as uncertain)
    // Gate 3 failures produce best-effort drafts that are expected to need edits,
    // so including them would skew the quality metrics.
    if (e.human_action && e.gate3_passed !== false) {
      if (e.human_action === "approved_no_edit") m.approvedNoEdit++;
      if (e.human_action === "approved_with_edit") m.approvedWithEdit++;
      if (e.human_action === "discarded") m.discarded++;
      if (e.edit_distance != null) {
        m.totalEditDistance += e.edit_distance;
        m.editDistanceCount++;
      }
    }
  }

  const metrics = Array.from(topicMetrics.values()).map((m) => {
    const shadowReviewed = m.approvedNoEdit + m.approvedWithEdit + m.discarded;
    return {
      topicId: m.topicId,
      topicName: m.topicName,
      total: m.total,
      gatePassRates: {
        gate1: m.total > 0 ? m.gate1Pass / m.total : 0,
        gate2: m.gate1Pass > 0 ? m.gate2Pass / m.gate1Pass : 0,
        gate3: m.gate2Pass > 0 ? m.gate3Pass / m.gate2Pass : 0,
        gate4: m.gate3Pass > 0 ? m.gate4Pass / m.gate3Pass : 0,
      },
      allGatesPassRate: m.total > 0 ? m.allGatesPass / m.total : 0,
      autoSent: m.autoSent,
      shadowTagged: m.shadowTagged,
      approvedNoEditRate: shadowReviewed > 0 ? m.approvedNoEdit / shadowReviewed : 0,
      approvedWithEditRate: shadowReviewed > 0 ? m.approvedWithEdit / shadowReviewed : 0,
      discardedRate: shadowReviewed > 0 ? m.discarded / shadowReviewed : 0,
      avgEditDistance: m.editDistanceCount > 0 ? m.totalEditDistance / m.editDistanceCount : 0,
      shadowReviewedCount: shadowReviewed,
    };
  });

  return NextResponse.json({ metrics });
}
