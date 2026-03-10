import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookFromHeaders, type InboundWebhookPayload } from "inboundemail";
import { getInboundClient } from "@/lib/email/inbound";
import { processInboundEmail } from "@/lib/email/process-inbound";
import { generateDraftForTicket } from "@/lib/email/generate-draft";

export async function POST(request: NextRequest) {
  const inbound = getInboundClient();

  const isValid = await verifyWebhookFromHeaders(request.headers, inbound);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const payload: InboundWebhookPayload = await request.json();

  try {
    const ticket = await processInboundEmail(payload);

    if (ticket) {
      await generateDraftForTicket(ticket.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Inbound email processing failed:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}
