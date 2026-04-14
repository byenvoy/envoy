import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Envoy",
  description: "AI-powered customer support with human-in-the-loop",
  openGraph: {
    title: "Envoy — Support that runs itself",
    description:
      "AI customer support with humans in the loop. Open source, self-hosted or managed.",
    siteName: "Envoy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Envoy — Support that runs itself",
    description:
      "AI customer support with humans in the loop. Open source, self-hosted or managed.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${instrumentSans.variable} ${dmMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
