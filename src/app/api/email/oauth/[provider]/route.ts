import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { withAuth } from "@/lib/db/helpers";
import { OAUTH_PROVIDERS, getClientCredentials, getRedirectUri } from "@/lib/email/oauth-config";

function signState(payload: string): string {
  const secret = process.env.ENCRYPTION_KEY!;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const auth = await withAuth();
  if (!auth.success) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { orgId } = auth.context;

  const config = OAUTH_PROVIDERS[provider];
  const creds = getClientCredentials(provider);
  const statePayload = JSON.stringify({
    orgId,
    provider,
  });
  const state = signState(Buffer.from(statePayload).toString("base64url"));

  const params_ = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    prompt: "consent",
  });

  // Google-specific: request offline access for refresh token
  if (provider === "google") {
    params_.set("access_type", "offline");
  }

  return NextResponse.redirect(`${config.authUrl}?${params_.toString()}`);
}
