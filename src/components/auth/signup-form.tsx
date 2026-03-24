"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: companyName,
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/check-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="fullName"
          className="mb-1 block font-display text-sm font-medium text-text-primary"
        >
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Jane Smith"
        />
      </div>
      <div>
        <label
          htmlFor="companyName"
          className="mb-1 block font-display text-sm font-medium text-text-primary"
        >
          Company name
        </label>
        <input
          id="companyName"
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Acme Inc."
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="mb-1 block font-display text-sm font-medium text-text-primary"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block font-display text-sm font-medium text-text-primary"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="At least 6 characters"
        />
      </div>
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2 font-display text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
