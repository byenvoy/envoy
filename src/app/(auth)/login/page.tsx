import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Sign in to Envoyer
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Enter your email and password to continue.
      </p>
      <LoginForm />
    </div>
  );
}
