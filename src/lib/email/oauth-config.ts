export interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  sentFolder: string;
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const OAUTH_PROVIDERS: Record<"google" | "microsoft", OAuthProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://mail.google.com/",
      "openid",
      "email",
      "profile",
    ],
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    sentFolder: "[Gmail]/Sent Mail",
  },
  microsoft: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: [
      "https://outlook.office365.com/IMAP.AccessAsUser.All",
      "https://outlook.office365.com/SMTP.Send",
      "offline_access",
      "openid",
      "email",
      "profile",
    ],
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    sentFolder: "Sent Items",
  },
};

export function getClientCredentials(provider: "google" | "microsoft") {
  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    };
  }
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  };
}

export function getRedirectUri() {
  return `${appUrl}/api/email/oauth/callback`;
}
