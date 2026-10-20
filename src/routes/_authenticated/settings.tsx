import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Spinner, btnPrimary, fieldCls } from "@/components/PageHeader";
import { useMyRole } from "@/lib/role";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Rollcall" }, { name: "description", content: "Profile and user access." }] }),
  component: SettingsPage,
});

async function fetchUsers() {
  const [p, r] = await Promise.all([supabase.from("profiles").select("id,full_name,email").order("created_at"), supabase.from("user_roles").select("user_id,role")]);
  if (p.error) throw p.error;
  return (p.data ?? []).map((u) => ({ ...u, roles: (r.data ?? []).filter((x) => x.user_id === u.id).map((x) => x.role as string) }));
}

function SettingsPage() {
  const qc = useQueryClient();
  const me = useMyRole();
  const [name, setName] = useState("");
  const isAdmin = me.data?.role === "admin";
  const users = useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled: isAdmin });

  useEffect(() => {
    if (me.data) supabase.from("profiles").select("full_name").eq("id", me.data.userId).maybeSingle().then(({ data }) => setName(data?.full_name ?? ""));
  }, [me.data]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name can't be empty."); return; }
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", me.data!.userId);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  }

  async function setTeacher(userId: string, on: boolean) {
    const { error } = on
      ? await supabase.from("user_roles").insert({ user_id: userId, role: "teacher" })
      : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "teacher");
    if (error) toast.error(error.message); else { toast.success(on ? "Teacher access granted" : "Teacher access removed"); qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["teachers"] }); }
  }

  if (me.isLoading) return <Spinner />;
  return (
    <>
      <PageHeader title="Settings" subtitle={`Signed in as ${me.data?.email} · ${me.data?.role ?? "no role yet"}`} />
      <form onSubmit={saveName} className="card-surface mb-6 max-w-lg space-y-3 p-6">
        <h2 className="font-semibold">Your profile</h2>
        <label className="block text-sm font-medium">Full name<input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={`${fieldCls} mt-1`} /></label>
        <button className={btnPrimary}>Save</button>
      </form>
      {isAdmin && (
        <div className="card-surface overflow-x-auto">
          <div className="p-5"><h2 className="font-semibold">Users & access</h2><p className="text-sm text-muted-foreground">Give teachers access here. Students get access automatically when their email is on their student record.</p></div>
          {users.isLoading ? <Spinner /> : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Teacher</th></tr></thead>
              <tbody>
                {users.data?.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">{u.full_name || "—"}</td><td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.roles.join(", ") || "none"}</td>
                    <td className="px-4 py-3">{!u.roles.includes("admin") && <input type="checkbox" className="h-4 w-4 accent-primary" checked={u.roles.includes("teacher")} onChange={(e) => setTeacher(u.id, e.target.checked)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
