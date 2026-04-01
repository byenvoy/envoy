"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function EmailVerificationPoller() {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const { data: session } = await authClient.getSession();
      if (session?.user?.emailVerified) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        router.push("/onboarding");
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  return null;
}
