"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ResendVerificationButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    setLoading(true);
    await authClient.sendVerificationEmail({
      email,
      callbackURL: "/onboarding",
    });
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return <span className="font-medium text-primary">Sent!</span>;
  }

  return (
    <button
      onClick={handleResend}
      disabled={loading}
      className="font-medium text-primary hover:underline disabled:opacity-50"
    >
      {loading ? "sending..." : "resend"}
    </button>
  );
}
