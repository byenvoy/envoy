import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface px-4">
      <div className="py-6 text-center">
        <span className="font-display text-[15px] font-bold tracking-tight text-primary">
          envoyer
        </span>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
