import { NextResponse } from "next/server";
import { withAuth } from "@/lib/db/helpers";
import { db } from "@/lib/db";
import { autopilotEvaluations } from "@/lib/db/schema";
import { eq, gte, and } from "drizzle-orm";

export async function GET() {
  const auth = await withAuth();
  if (!auth.success) return auth.response;
  const { orgId } = auth.context;

  // Fetch all evaluations for the org in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const evaluations = await db
      .select({
        gate1TopicId: autopilotEvaluations.gate1TopicId,
        gate1TopicName: autopilotEvaluations.gate1TopicName,
        gate1Passed: autopilotEvaluations.gate1Passed,
        gate2Passed: autopilotEvaluations.gate2Passed,
        gate3Passed: autopilotEvaluations.gate3Passed,
        gate4Passed: autopilotEvaluations.gate4Passed,
        allGatesPassed: autopilotEvaluations.allGatesPassed,
        outcome: autopilotEvaluations.outcome,
        humanAction: autopilotEvaluations.humanAction,
        editDistance: autopilotEvaluations.editDistance,
      })
      .from(autopilotEvaluations)
      .where(
        and(
          eq(autopilotEvaluations.orgId, orgId),
          gte(autopilotEvaluations.createdAt, thirtyDaysAgo)
        )
      );

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

    for (const e of evaluations) {
      const key = e.gate1TopicId ?? "unmatched";
      if (!topicMetrics.has(key)) {
        topicMetrics.set(key, {
          topicId: e.gate1TopicId ?? "unmatched",
          topicName: e.gate1TopicName ?? "Unmatched",
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
      if (e.gate1Passed) m.gate1Pass++;
      if (e.gate2Passed) m.gate2Pass++;
      if (e.gate3Passed) m.gate3Pass++;
      if (e.gate4Passed) m.gate4Pass++;
      if (e.allGatesPassed) m.allGatesPass++;
      if (e.outcome === "auto_sent") m.autoSent++;
      if (e.outcome === "shadow_tagged") m.shadowTagged++;
      // Only count human actions from drafts where gate3 passed (not flagged as uncertain)
      // Gate 3 failures produce best-effort drafts that are expected to need edits,
      // so including them would skew the quality metrics.
      if (e.humanAction && e.gate3Passed !== false) {
        if (e.humanAction === "approved_no_edit") m.approvedNoEdit++;
        if (e.humanAction === "approved_with_edit") m.approvedWithEdit++;
        if (e.humanAction === "discarded") m.discarded++;
        if (e.editDistance != null) {
          m.totalEditDistance += e.editDistance;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
