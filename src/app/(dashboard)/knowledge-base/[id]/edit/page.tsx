import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { EditPageForm } from "./edit-page-form";

export default async function EditKnowledgeBasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: page } = await supabase
    .from("knowledge_base_pages")
    .select("id, title, markdown_content")
    .eq("id", id)
    .single();

  if (!page) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Edit Page
        </h1>
      </div>
      <EditPageForm
        pageId={page.id}
        initialTitle={page.title ?? ""}
        initialContent={page.markdown_content ?? ""}
      />
    </div>
  );
}
