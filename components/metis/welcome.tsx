"use client";
import { Button } from "@/components/ui/button";

const STARTER_QUERIES = [
  "What's the current state of our HHMI engagement?",
  "Walk me through ROPE. What is it and when do we use it?",
  "What's our POV on context engineering?",
  "Based on our HHMI engagement and research on enterprise AI adoption, what should we expect from a similar institution?",
];

export function Welcome({ onStart }: { onStart: (q: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl p-8 space-y-5 text-center">
      <h1 className="text-2xl font-semibold">Metis</h1>
      <p className="text-muted-foreground">
        Cadre&apos;s knowledge chat surface. Ask anything the wiki knows.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {STARTER_QUERIES.map((q) => (
          <Button
            className="justify-start text-left h-auto py-3 whitespace-normal"
            key={q}
            onClick={() => onStart(q)}
            variant="outline"
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}
