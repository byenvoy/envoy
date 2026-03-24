"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(f: File) {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError("Please upload a PDF or DOCX file.");
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to upload");
      }

      fetch("/api/embeddings/generate", { method: "POST" });
      router.push("/knowledge-base");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-display tracking-tight text-text-primary">
          Upload File
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload a PDF or DOCX file to add to your knowledge base.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${
            dragOver
              ? "border-primary bg-surface"
              : "border-border hover:border-primary"
          }`}
        >
          <svg
            className="mb-3 h-8 w-8 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          {file ? (
            <p className="text-sm font-medium font-display text-text-primary">
              {file.name}{" "}
              <span className="font-normal font-mono text-text-secondary">
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
            </p>
          ) : (
            <>
              <p className="text-sm font-medium font-display text-text-primary">
                Drop a file here or click to browse
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                PDF or DOCX, up to 10 MB
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium font-display text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload & Import"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/knowledge-base")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium font-display text-text-secondary transition-colors hover:bg-surface"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
