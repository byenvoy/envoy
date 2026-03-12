import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "crypto";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const config = OAUTH_PROVIDERS[provider];
  const creds = getClientCredentials(provider);
  const statePayload = JSON.stringify({
    orgId: profile.org_id,
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
