import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Rollcall" },
      { name: "description", content: "Sign in to Rollcall to manage classes, mark attendance or view your record." },
      { property: "og:title", content: "Sign in — Rollcall" },
      { property: "og:description", content: "Access your Rollcall attendance account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const field = "mt-1 w-full rounded-lg border border-input bg-background/60 px-3 py-2 outline-none focus:ring-2 focus:ring-ring";
  return (
    <Shell>
      <main className="flex justify-center py-16">
        <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-sm rounded-2xl border border-border bg-panel-navy p-8 backdrop-blur">
          <h1 className="text-2xl font-bold">{mode === "in" ? "Welcome back" : "Create account"}</h1>
          {mode === "up" && (
            <label className="mt-6 block text-sm">Full name<input className={field} required /></label>
          )}
          <label className="mt-6 block text-sm">Email<input type="email" className={field} required /></label>
          <label className="mt-4 block text-sm">Password<input type="password" className={field} required /></label>
          <button className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {mode === "in" ? "Sign in" : "Sign up"}
          </button>
          <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </main>
    </Shell>
  );
}
