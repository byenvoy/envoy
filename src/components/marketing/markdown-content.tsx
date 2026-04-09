import { marked } from "marked";

export function MarkdownContent({ content }: { content: string }) {
  const html = marked.parse(content, { async: false }) as string;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
