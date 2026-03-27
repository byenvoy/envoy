import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeBasePages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { EditPageForm } from "./edit-page-form";

export default async function EditKnowledgeBasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const page = await db
    .select({
      id: knowledgeBasePages.id,
      title: knowledgeBasePages.title,
      markdownContent: knowledgeBasePages.markdownContent,
    })
    .from(knowledgeBasePages)
    .where(eq(knowledgeBasePages.id, id))
    .then((r) => r[0]);

  if (!page) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-display tracking-tight text-text-primary">
          Edit Page
        </h1>
      </div>
      <EditPageForm
        pageId={page.id}
        initialTitle={page.title ?? ""}
        initialContent={page.markdownContent ?? ""}
      />
    </div>
  );
}
