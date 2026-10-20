import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Spinner, btnGhost, btnPrimary, fieldCls } from "@/components/PageHeader";
import { fetchStudents, studentsKey } from "@/lib/data";
import { DEPARTMENTS, SECTIONS, YEARS } from "@/lib/attendance";
import { useMyRole } from "@/lib/role";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes — Rollcall" }, { name: "description", content: "Classes, teachers and rosters." }] }),
  component: Classes,
});

export type ClassRow = { id: string; name: string; department: string; year: number; section: string; teacher_id: string | null };

export async function fetchClasses(): Promise<{ classes: ClassRow[]; roster: { class_id: string; student_id: string }[] }> {
  const [c, r] = await Promise.all([
    supabase.from("classes").select("id,name,department,year,section,teacher_id").order("name"),
    supabase.from("class_students").select("class_id,student_id"),
  ]);
  if (c.error) throw c.error;
  if (r.error) throw r.error;
  return { classes: c.data as ClassRow[], roster: r.data };
}

async function fetchTeachers() {
  const { data: roles, error } = await supabase.from("user_roles").select("user_id,role").in("role", ["teacher", "admin"]);
  if (error) throw error;
  const ids = [...new Set(roles.map((r) => r.user_id))];
  if (!ids.length) return [];
  const { data } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
  return data ?? [];
}

function Classes() {
  const qc = useQueryClient();
  const me = useMyRole();
  const isAdmin = me.data?.role === "admin";
  const cls = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const teachers = useQuery({ queryKey: ["teachers"], queryFn: fetchTeachers });
  const students = useQuery({ queryKey: studentsKey, queryFn: fetchStudents });
  const [form, setForm] = useState<{ name: string; department: string; year: number; section: string; teacher_id: string } | null>(null);
  const [rosterFor, setRosterFor] = useState<ClassRow | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["classes"] });
  const run = (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) =>
    fn().then(({ error }) => { if (error) toast.error(error.message); else { toast.success(ok); refresh(); } });

  const create = useMutation({
    mutationFn: async (f: NonNullable<typeof form>) => {
      if (!f.name.trim()) throw new Error("Class name is required.");
      const { error } = await supabase.from("classes").insert({ ...f, name: f.name.trim(), teacher_id: f.teacher_id || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Class created"); setForm(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (cls.isLoading || students.isLoading) return <Spinner />;
  if (cls.error) return <p className="text-danger">{cls.error.message}</p>;
  const { classes, roster } = cls.data!;
  const tName = (id: string | null) => { const t = teachers.data?.find((x) => x.id === id); return t ? t.full_name || t.email : "Unassigned"; };
  const visible = isAdmin ? classes : classes.filter((c) => c.teacher_id === me.data?.userId);

  return (
    <>
      <PageHeader title="Classes" subtitle={isAdmin ? "Create classes, assign teachers and manage rosters" : "Classes assigned to you"}
        action={isAdmin && <button className={btnPrimary} onClick={() => setForm({ name: "", department: "CSE", year: 1, section: "A", teacher_id: "" })}><Plus className="h-4 w-4" />New class</button>} />
      {visible.length === 0 && <div className="card-surface p-10 text-center text-muted-foreground">{isAdmin ? "No classes yet." : "No classes are assigned to you yet. Ask an administrator."}</div>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => {
          const count = roster.filter((r) => r.class_id === c.id).length;
          return (
            <div key={c.id} className="card-surface p-5 animate-rise">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.department} · Year {c.year} · Section {c.section}</p>
                </div>
                {isAdmin && <button aria-label="Delete class" className="rounded-lg p-1.5 text-danger hover:bg-danger-soft" onClick={() => confirm(`Delete ${c.name}?`) && run(() => supabase.from("classes").delete().eq("id", c.id), "Class deleted")}><Trash2 className="h-4 w-4" /></button>}
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-primary" />{count} students</p>
              {isAdmin ? (
                <select className={`${fieldCls} mt-3`} value={c.teacher_id ?? ""} onChange={(e) => run(() => supabase.from("classes").update({ teacher_id: e.target.value || null }).eq("id", c.id), "Teacher assigned")}>
                  <option value="">Unassigned</option>
                  {teachers.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}
                </select>
              ) : <p className="mt-2 text-sm text-muted-foreground">Teacher: {tName(c.teacher_id)}</p>}
              <button className={`${btnGhost} mt-3 w-full`} onClick={() => setRosterFor(c)}><UserPlus className="h-4 w-4" />{isAdmin ? "Manage roster" : "View roster"}</button>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setForm(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="card-surface w-full max-w-md space-y-4 p-6">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New class</h2><button type="button" onClick={() => setForm(null)}><X className="h-5 w-5" /></button></div>
            <label className="block text-sm font-medium">Class name<input required maxLength={80} placeholder="e.g. CSE 2-A Data Structures" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${fieldCls} mt-1`} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm font-medium">Dept<select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={`${fieldCls} mt-1`}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></label>
              <label className="text-sm font-medium">Year<select value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={`${fieldCls} mt-1`}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></label>
              <label className="text-sm font-medium">Section<select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className={`${fieldCls} mt-1`}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
            <label className="block text-sm font-medium">Teacher<select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} className={`${fieldCls} mt-1`}><option value="">Unassigned</option>{teachers.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}</select></label>
            <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={() => setForm(null)}>Cancel</button><button className={btnPrimary} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</button></div>
          </form>
        </div>
      )}

      {rosterFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setRosterFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card-surface flex max-h-[85vh] w-full max-w-2xl flex-col p-6">
            <p className="mb-3 rounded-lg bg-accent p-3 text-xs text-accent-foreground">Student login: enter a student's email and press Give access. They can then sign up or sign in with that email to see their own attendance.</p>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Roster · {rosterFor.name}</h2><button onClick={() => setRosterFor(null)}><X className="h-5 w-5" /></button></div>
            <div className="flex-1 space-y-1 overflow-y-auto">
              {(students.data ?? []).filter((s) => isAdmin || roster.some((r) => r.class_id === rosterFor.id && r.student_id === s.id)).map((s) => {
                const inClass = roster.some((r) => r.class_id === rosterFor.id && r.student_id === s.id);
                return (
                  <label key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                    {isAdmin && <input type="checkbox" checked={inClass} className="h-4 w-4 accent-primary" onChange={() => run(
                      () => inClass ? supabase.from("class_students").delete().eq("class_id", rosterFor.id).eq("student_id", s.id) : supabase.from("class_students").insert({ class_id: rosterFor.id, student_id: s.id }),
                      inClass ? "Removed from class" : "Added to class")} />}
                    <span className="font-mono text-xs text-muted-foreground">{s.roll_number}</span>
                    <span className="text-sm">{s.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{s.department} {s.year}-{s.section}</span>
                    {inClass && (isAdmin || rosterFor.teacher_id === me.data?.userId) && <EmailAccess studentId={s.id} email={s.email} />}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EmailAccess({ studentId, email }: { studentId: string; email: string | null }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(email ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("set_student_email", { _student_id: studentId, _email: value });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(value ? "Student login access given" : "Student login access removed");
    qc.invalidateQueries({ queryKey: studentsKey });
  }
  return (
    <span className="flex w-full items-center gap-2 pl-7" onClick={(e) => e.preventDefault()}>
      <input type="email" placeholder="student@email.com" value={value} onChange={(e) => setValue(e.target.value)} className={`${fieldCls} py-1.5 text-xs`} />
      <button type="button" onClick={save} disabled={busy || value === (email ?? "")} className={`${btnPrimary} whitespace-nowrap px-3 py-1.5 text-xs`}>{busy ? "Saving…" : email && !value ? "Remove" : "Give access"}</button>
    </span>
  );
}
