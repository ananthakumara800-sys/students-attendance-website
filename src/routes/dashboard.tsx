import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Shell } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Rollcall" },
      { name: "description", content: "Your Rollcall attendance dashboard." },
      { property: "og:title", content: "Dashboard — Rollcall" },
      { property: "og:description", content: "Your Rollcall attendance dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
      else setUser(data.session.user);
    });
  }, [navigate]);

  if (!user) return <Shell><p className="py-20 text-muted-foreground">Loading…</p></Shell>;
  const name = (user.user_metadata?.["full_name"] as string) || user.email;

  return (
    <Shell>
      <main className="py-14">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
        <h1 className="mt-4 text-4xl font-bold">Hello, <span className="text-hero-gradient">{name}</span></h1>
        <p className="mt-3 text-muted-foreground">You're signed in as {user.email}.</p>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
          className="mt-8 rounded-lg border border-border bg-background/60 px-5 py-2 text-sm hover:bg-background"
        >
          Sign out
        </button>
      </main>
    </Shell>
  );
}
