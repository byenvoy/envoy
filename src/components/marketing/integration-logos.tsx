import Image from "next/image";

function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22 6.25V17.75C22 18.44 21.44 19 20.75 19H18V9.25L12 13.25L6 9.25V19H3.25C2.56 19 2 18.44 2 17.75V6.25C2 4.81 3.69 3.97 4.83 4.88L6 5.75L12 9.75L18 5.75L19.17 4.88C20.31 3.97 22 4.81 22 6.25Z" fill="#EA4335" />
      <path d="M6 9.25V19H3.25C2.56 19 2 18.44 2 17.75V6.25C2 4.81 3.69 3.97 4.83 4.88L6 5.75V9.25Z" fill="#4285F4" />
      <path d="M18 9.25V19H20.75C21.44 19 22 18.44 22 17.75V6.25C22 4.81 20.31 3.97 19.17 4.88L18 5.75V9.25Z" fill="#34A853" />
      <path d="M6 5.75L12 9.75L18 5.75V9.25L12 13.25L6 9.25V5.75Z" fill="#FBBC05" />
    </svg>
  );
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22 7.5V16.5C22 17.33 21.33 18 20.5 18H10V6H20.5C21.33 6 22 6.67 22 7.5Z" fill="#0078D4" />
      <path d="M14 12C14 13.66 12.66 15 11 15C9.34 15 8 13.66 8 12C8 10.34 9.34 9 11 9C12.66 9 14 10.34 14 12Z" fill="#0078D4" />
      <path d="M2 7L9 5V19L2 17V7Z" fill="#0364B8" />
      <ellipse cx="5.5" cy="12" rx="2" ry="2.5" fill="white" />
    </svg>
  );
}

function ShopifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M15.34 5.47C15.34 5.47 15.13 5.53 14.81 5.63C14.75 5.39 14.65 5.11 14.5 4.83C14.07 4.05 13.4 3.63 12.6 3.63C12.47 3.63 12.34 3.64 12.2 3.67C12.16 3.62 12.12 3.57 12.08 3.53C11.74 3.17 11.31 3 10.81 3.01C9.83 3.04 8.86 3.75 8.07 4.97C7.51 5.84 7.09 6.93 6.96 7.77C5.81 8.12 5.01 8.37 4.99 8.38C4.41 8.56 4.39 8.58 4.32 9.12C4.27 9.53 3 19.5 3 19.5L15.49 21.5V5.45C15.43 5.46 15.38 5.47 15.34 5.47Z" fill="#95BF47" />
      <path d="M15.34 5.47C15.34 5.47 15.13 5.53 14.81 5.63C14.75 5.39 14.65 5.11 14.5 4.83C14.07 4.05 13.4 3.63 12.6 3.63C12.47 3.63 12.34 3.64 12.2 3.67C12.16 3.62 12.12 3.57 12.08 3.53C11.74 3.17 11.31 3 10.81 3.01C9.83 3.04 8.86 3.75 8.07 4.97C7.51 5.84 7.09 6.93 6.96 7.77L6.96 7.77C6.96 7.77 6.96 7.77 6.96 7.77L15.49 5.45C15.43 5.46 15.38 5.47 15.34 5.47Z" fill="#95BF47" />
      <path d="M12.6 3.63C12.47 3.63 12.34 3.64 12.2 3.67C12.16 3.62 12.12 3.57 12.08 3.53C11.74 3.17 11.31 3 10.81 3.01C9.83 3.04 8.86 3.75 8.07 4.97C7.51 5.84 7.09 6.93 6.96 7.77L15.49 5.45V5.45C15.43 5.46 15.38 5.47 15.34 5.47C15.34 5.47 15.13 5.53 14.81 5.63C14.75 5.39 14.65 5.11 14.5 4.83C14.07 4.05 13.4 3.63 12.6 3.63Z" fill="#5E8E3E" />
      <path d="M21 7.5L19.5 19L15.49 21.5V5.45L17.16 5C17.16 5 17.49 6.87 17.5 6.95C17.55 7.14 17.68 7.23 17.83 7.23C17.98 7.23 21 7.5 21 7.5Z" fill="#5E8E3E" />
    </svg>
  );
}

function StripeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="#635BFF" />
      <path
        d="M11.5 10.5C10.5 10.1 9.9 9.8 9.9 9.3C9.9 8.9 10.3 8.6 10.9 8.6C11.8 8.6 12.6 9 12.6 9L13.1 7.5C13.1 7.5 12.4 7 10.9 7C9.2 7 8 8 8 9.4C8 10.5 8.8 11.2 10 11.6C10.9 11.9 11.2 12.2 11.2 12.7C11.2 13.2 10.7 13.5 10.1 13.5C9.1 13.5 8.1 13 8.1 13L7.6 14.5C7.6 14.5 8.5 15.1 10.1 15.1C11.9 15.1 13.1 14.1 13.1 12.6C13.1 11.4 12.3 10.8 11.5 10.5Z"
        fill="white"
      />
    </svg>
  );
}

function DockerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M13.98 11.08H12.69V9.92H13.98V11.08ZM12.36 11.08H11.07V9.92H12.36V11.08ZM10.73 11.08H9.44V9.92H10.73V11.08ZM9.11 11.08H7.82V9.92H9.11V11.08ZM10.73 9.58H9.44V8.42H10.73V9.58ZM12.36 9.58H11.07V8.42H12.36V9.58ZM13.98 9.58H12.69V8.42H13.98V9.58ZM12.36 8.08H11.07V6.92H12.36V8.08ZM21.82 11.41C21.5 11.12 20.47 10.82 19.66 10.97C19.57 10.26 19.17 9.64 18.48 9.08L18.07 8.79L17.78 9.2C17.4 9.77 17.18 10.55 17.24 11.29C17.27 11.58 17.36 12.08 17.66 12.5C17.42 12.64 16.89 12.83 16.18 12.83H2.05L2 13.01C1.88 13.74 1.88 16.08 3.38 17.84C4.5 19.14 6.15 19.81 8.28 19.81C13.19 19.81 16.86 17.55 18.53 13.83C19.27 13.84 20.82 13.83 21.58 12.23L21.72 11.94L21.82 11.41Z"
        fill="#2496ED"
      />
    </svg>
  );
}

const integrationGroups = [
  {
    label: "Email",
    items: [
      { name: "Gmail", icon: <GmailIcon className="h-8 w-8" /> },
      { name: "Outlook", icon: <OutlookIcon className="h-8 w-8" /> },
    ],
  },
  {
    label: "Customer Context",
    items: [
      { name: "Shopify", icon: <ShopifyIcon className="h-8 w-8" /> },
      {
        name: "Stripe",
        icon: <StripeIcon className="h-8 w-8" />,
        comingSoon: true,
      },
    ],
  },
  {
    label: "Self-host",
    items: [{ name: "Docker", icon: <DockerIcon className="h-8 w-8" /> }],
  },
];

export function IntegrationLogos() {
  return (
    <div className="flex flex-wrap gap-12 sm:gap-16">
      {integrationGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-text-secondary">
            {group.label}
          </p>
          <div className="flex items-center gap-6">
            {group.items.map((item) => (
              <div key={item.name} className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-surface-alt">
                  {item.icon}
                </div>
                <span className="font-body text-xs text-text-secondary">
                  {item.name}
                  {"comingSoon" in item && item.comingSoon && (
                    <span className="ml-1 text-[10px] text-text-secondary/60">
                      soon
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModelLogos() {
  const models = [
    { name: "Claude", src: "/logos/anthropic.svg", darkSrc: "/logos/Anthropic symbol - Ivory.svg" },
    { name: "GPT-4o", src: "/logos/openai.svg", darkSrc: "/logos/OpenAI-white-monoblossom.svg" },
    { name: "Gemini", src: "/logos/gemini-icon.png" },
    { name: "Mistral", src: "/logos/mistral.svg" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-6">
      {models.map((model) => (
        <div key={model.name} className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-alt p-1.5">
            <Image
              src={model.src}
              alt={model.name}
              width={28}
              height={28}
              className={`h-7 w-7 object-contain ${model.darkSrc ? "dark:hidden" : ""}`}
            />
            {model.darkSrc && (
              <Image
                src={model.darkSrc}
                alt={model.name}
                width={28}
                height={28}
                className="hidden h-7 w-7 object-contain dark:block"
              />
            )}
          </div>
          <span className="font-body text-xs text-text-secondary">
            {model.name}
          </span>
        </div>
      ))}
    </div>
  );
}
