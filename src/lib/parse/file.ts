import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";

export interface ParsedFile {
  title: string;
  content: string;
}

export async function parseFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ParsedFile> {
  const title = filename.replace(/\.[^.]+$/, "");

  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const text = result.text?.trim();
    await parser.destroy();
    if (!text) {
      throw new Error("PDF contains no extractable text");
    }
    return { title, content: text };
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    // @ts-expect-error mammoth types don't include convertToMarkdown but it exists at runtime
    const result = await mammoth.convertToMarkdown({ buffer });
    if (!result.value?.trim()) {
      throw new Error("Document contains no extractable text");
    }
    return { title, content: result.value };
  }

  throw new Error(
    "Unsupported file type. Please upload a PDF or DOCX file."
  );
}
