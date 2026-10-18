import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

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
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/dashboard" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ ok: false, text: error.message });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) setMsg({ ok: false, text: error.message });
      else if (!data.session) setMsg({ ok: true, text: "Check your email to confirm your account, then sign in." });
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg({ ok: false, text: r.error.message ?? "Google sign-in failed" });
  }

  const field = "mt-1 w-full rounded-lg border border-input bg-background/60 px-3 py-2 outline-none focus:ring-2 focus:ring-ring";
  return (
    <Shell>
      <main className="flex justify-center py-16">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-panel-navy p-8 backdrop-blur">
          <h1 className="text-2xl font-bold">{mode === "in" ? "Welcome back" : "Create account"}</h1>
          <button type="button" onClick={google} className="mt-6 w-full rounded-lg border border-border bg-background/60 py-2.5 text-sm font-medium hover:bg-background">
            Continue with Google
          </button>
          <div className="my-5 text-center text-xs uppercase tracking-widest text-muted-foreground">or</div>
          {mode === "up" && (
            <label className="block text-sm">Full name<input value={name} onChange={(e) => setName(e.target.value)} className={field} required /></label>
          )}
          <label className="mt-4 block text-sm">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required /></label>
          <label className="mt-4 block text-sm">Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={field} required /></label>
          {msg && <p className={`mt-4 text-sm ${msg.ok ? "text-hero-blue" : "text-hero-red"}`}>{msg.text}</p>}
          <button disabled={busy} className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
          </button>
          <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </main>
    </Shell>
  );
}
