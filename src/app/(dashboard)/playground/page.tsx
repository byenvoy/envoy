import { PlaygroundForm } from "@/components/playground/playground-form";

export default function PlaygroundPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-display tracking-tight text-text-primary">
          Playground
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Paste a customer email and get an AI-drafted reply grounded in your
          knowledge base.
        </p>
      </div>
      <PlaygroundForm />
    </div>
  );
}
