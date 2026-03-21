import Link from "next/link";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6 text-zinc-600 dark:text-zinc-300"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
          />
        </svg>
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Check your email
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        We sent a confirmation link to{" "}
        {email ? (
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {email}
          </span>
        ) : (
          "your email"
        )}
        . Click the link to verify your account and get started.
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Didn&apos;t receive it? Check your spam folder, or{" "}
        <Link
          href="/signup"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          try again
        </Link>
        .
      </p>
    </div>
  );
}
