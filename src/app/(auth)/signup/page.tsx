import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Create your account
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Get started with Envoyer for your team.
      </p>
      <SignupForm />
    </div>
  );
}
