import { ResendVerificationButton } from "@/components/auth/resend-verification-button";
import { EmailVerificationPoller } from "@/components/auth/email-verification-poller";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="text-center">
      <EmailVerificationPoller />
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6 text-primary"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
          />
        </svg>
      </div>
      <h1 className="mb-2 font-display text-2xl font-bold tracking-tight text-text-primary">
        Check your email
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        We sent a confirmation link to{" "}
        {email ? (
          <span className="font-medium text-text-primary">
            {email}
          </span>
        ) : (
          "your email"
        )}
        . Click the link to verify your account and get started.
      </p>
      <p className="text-sm text-text-secondary">
        Didn&apos;t receive it? Check your spam folder, or{" "}
        {email ? (
          <ResendVerificationButton email={email} />
        ) : (
          <>
            <a
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              try again
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}
