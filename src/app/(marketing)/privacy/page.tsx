import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { MarkdownContent } from "@/components/marketing/markdown-content";

export const metadata: Metadata = {
  title: "Privacy Policy — Envoy",
};

export default function PrivacyPage() {
  const content = fs.readFileSync(
    path.join(process.cwd(), "content/privacy.md"),
    "utf-8"
  );

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="prose mx-auto max-w-[720px]">
        <MarkdownContent content={content} />
      </div>
    </main>
  );
}
