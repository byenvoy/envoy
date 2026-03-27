import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface px-4">
      <div className="py-6 text-center">
        <span className="font-display text-xl font-bold tracking-tight text-primary">
          envoyer
        </span>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
