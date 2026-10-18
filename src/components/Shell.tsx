import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import bg from "@/assets/web-bg.jpg";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <img src={bg} alt="" width={1920} height={1088} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/70" />
      <div className="relative mx-auto max-w-6xl px-6">
        <header className="flex items-center justify-between py-6">
          <Link to="/" className="text-hero-gradient text-2xl font-extrabold tracking-tight">Rollcall</Link>
          <Link to="/auth" className="rounded-lg border border-border bg-background/50 px-4 py-2 text-sm backdrop-blur hover:bg-background/80">Sign in</Link>
        </header>
        {children}
      </div>
    </div>
  );
}
