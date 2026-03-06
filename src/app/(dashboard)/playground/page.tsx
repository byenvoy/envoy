import { PlaygroundForm } from "@/components/playground/playground-form";

export default function PlaygroundPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Playground
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Paste a customer email and get an AI-drafted reply grounded in your
          knowledge base.
        </p>
      </div>
      <PlaygroundForm />
    </div>
  );
}
