import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LayoutDashboard, Users, ClipboardCheck, BarChart3, Settings, LogOut, Menu, X, School } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/role";
import { Spinner } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

type NavItem = { to: "/dashboard" | "/students" | "/classes" | "/attendance" | "/reports" | "/settings" | "/my-attendance"; label: string; icon: typeof Users };
const staffNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/classes", label: "Classes", icon: School },
  { to: "/attendance", label: "Mark Attendance", icon: ClipboardCheck },
  { to: "/reports", label: "Attendance Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];
const studentNav: NavItem[] = [
  { to: "/my-attendance", label: "My Attendance", icon: ClipboardCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Layout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const me = useMyRole();
  const role = me.data?.role ?? null;
  const nav = role === "student" ? studentNav : role ? staffNav : [{ to: "/settings", label: "Settings", icon: Settings } as NavItem];

  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ClipboardCheck className="h-5 w-5" /></div>
        <div>
          <p className="font-bold leading-tight text-sidebar-accent-foreground">Rollcall</p>
          <p className="text-xs opacity-70">Attendance System</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((n) => {
          const active = path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={logout} className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <LogOut className="h-4 w-4" />Logout
      </button>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          {sidebar}
          <button aria-label="Close menu" className="flex-1 bg-foreground/40" onClick={() => setOpen(false)}><X className="m-4 h-6 w-6 text-background" /></button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
          <span className="font-bold">Rollcall</span>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">
          {me.isLoading ? <Spinner /> : !role && !path.startsWith("/settings") ? (
            <div className="card-surface mx-auto mt-10 max-w-lg p-8 text-center">
              <h1 className="text-xl font-bold">Waiting for access</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your account ({me.data?.email}) has no role yet. Ask an administrator to make you a teacher, or to add your email to your student record.</p>
            </div>
          ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}
