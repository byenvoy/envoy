// Transactional email (verification, password reset, invites, billing notices)
// via Cloudflare Email Sending. Separate from the customer-facing Gmail send
// path in send-reply.ts.
//
// Env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN, EMAIL_FROM
// The EMAIL_FROM domain must be onboarded to Cloudflare Email Sending
// (`npx wrangler email sending enable <domain>`).

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendResult = { error: string | null };

// EMAIL_FROM accepts "Name <addr@domain>" or a bare address.
function parseFrom(raw: string): { address: string; name?: string } {
  const match = raw.match(/^(.*)<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { address: match[2].trim(), ...(name ? { name } : {}) };
  }
  return { address: raw.trim() };
}

async function postSend(body: string): Promise<Response> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_EMAIL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body,
    },
  );
}

/**
 * Send a transactional email. Never throws — failures are logged and returned
 * as `{ error }`, so fire-and-forget callers (`void sendTransactionalEmail(...)`)
 * are safe.
 */
export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: SendArgs): Promise<SendResult> {
  if (
    !process.env.CLOUDFLARE_ACCOUNT_ID ||
    !process.env.CLOUDFLARE_EMAIL_API_TOKEN ||
    !process.env.EMAIL_FROM
  ) {
    const error =
      "missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_EMAIL_API_TOKEN, or EMAIL_FROM";
    console.error(`[email] not sent ("${subject}"): ${error}`);
    return { error };
  }

  const body = JSON.stringify({
    to,
    from: parseFrom(process.env.EMAIL_FROM),
    subject,
    html,
    ...(text ? { text } : {}),
  });

  try {
    let res = await postSend(body);
    // Retry once on rate limit / server error; 4xx validation errors won't
    // succeed on retry.
    if (res.status === 429 || res.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      res = await postSend(body);
    }

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      errors?: { code: number; message: string }[];
      result?: { permanent_bounces?: string[] };
    } | null;

    if (!res.ok || !json?.success) {
      const error =
        json?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ||
        `HTTP ${res.status}`;
      console.error(`[email] send failed ("${subject}" to ${to}): ${error}`);
      return { error };
    }

    if (json.result?.permanent_bounces?.length) {
      const error = `permanent bounce: ${json.result.permanent_bounces.join(", ")}`;
      console.error(`[email] send failed ("${subject}"): ${error}`);
      return { error };
    }

    return { error: null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] send failed ("${subject}" to ${to}): ${error}`);
    return { error };
  }
}
