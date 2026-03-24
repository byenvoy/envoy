import { createAdminClient } from "@/lib/supabase/admin";
import { getValidTokens } from "./oauth-tokens";
import { createTransport } from "nodemailer";
import type { Ticket, EmailConnection } from "@/lib/types/database";

export async function sendReply(
  ticket: Ticket,
  replyContent: string,
  replyHtml: string,
  emailAddr: { email_address: string; display_name: string | null }
): Promise<void> {
  if (!ticket.connection_id) {
    throw new Error("No email connection associated with this ticket");
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("email_connections")
    .select("*")
    .eq("id", ticket.connection_id)
    .single();

  if (!connection) throw new Error("Email connection not found");

  const tokens = await getValidTokens(connection as EmailConnection);

  const transport = createTransport({
    host: connection.smtp_host,
    port: connection.smtp_port,
    secure: false,
    auth: {
      type: "OAuth2",
      user: connection.email_address,
      accessToken: tokens.access_token,
    },
  });

  const from = emailAddr.display_name
    ? `${emailAddr.display_name} <${emailAddr.email_address}>`
    : emailAddr.email_address;

  await transport.sendMail({
    from,
    to: ticket.from_email,
    subject: ticket.subject ? `Re: ${ticket.subject.replace(/^Re:\s*/i, "")}` : undefined,
    text: replyContent,
    html: replyHtml,
    inReplyTo: ticket.message_id ?? undefined,
    references: ticket.message_id ? [ticket.message_id] : undefined,
  });
}
