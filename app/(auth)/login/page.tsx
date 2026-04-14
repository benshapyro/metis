"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";

  return (
    <div className="min-h-dvh flex items-center justify-center p-8">
      <form
        className="w-full max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await signIn("credentials", {
              password,
              redirect: false,
            });
            if (res?.ok) {
              router.push(callbackUrl);
            } else {
              setError("Wrong password.");
            }
          });
        }}
      >
        <h1 className="text-2xl font-semibold">Metis</h1>
        <p className="text-sm text-muted-foreground">
          Cadre&apos;s knowledge chat surface.
        </p>
        <Input
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          className="w-full"
          disabled={pending || !password}
          type="submit"
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
