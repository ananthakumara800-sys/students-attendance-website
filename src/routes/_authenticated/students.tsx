import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Spinner, btnGhost, btnPrimary, fieldCls } from "@/components/PageHeader";
import { fetchStudents, studentsKey, type Student } from "@/lib/data";
import { DEPARTMENTS, SECTIONS, YEARS } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — Rollcall" }, { name: "description", content: "Manage student records." }] }),
  component: Students,
});

type Form = { name: string; roll_number: string; department: string; year: number; section: string };
const empty: Form = { name: "", roll_number: "", department: "CSE", year: 1, section: "A" };

function Students() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: studentsKey, queryFn: fetchStudents });
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [year, setYear] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<Form | null>(null);

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const payload = { ...f, name: f.name.trim(), roll_number: f.roll_number.trim().toUpperCase() };
      if (!payload.name || !payload.roll_number) throw new Error("Name and roll number are required.");
      const res = editing
        ? await supabase.from("students").update(payload).eq("id", editing.id)
        : await supabase.from("students").insert(payload);
      if (res.error) throw new Error(res.error.code === "23505" ? "That roll number already exists." : res.error.message);
    },
    onSuccess: () => { toast.success(editing ? "Student updated" : "Student added"); setForm(null); setEditing(null); qc.invalidateQueries({ queryKey: studentsKey }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("students").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Student deleted"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (data ?? []).filter((s) =>
    (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.roll_number.toLowerCase().includes(q.toLowerCase())) &&
    (!dept || s.department === dept) && (!year || s.year === Number(year)));

  return (
    <>
      <PageHeader title="Students" subtitle={`${data?.length ?? 0} students enrolled`}
        action={<button className={btnPrimary} onClick={() => { setEditing(null); setForm(empty); }}><Plus className="h-4 w-4" />Add student</button>} />

      <div className="card-surface mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input placeholder="Search name or roll number" value={q} onChange={(e) => setQ(e.target.value)} className={`${fieldCls} pl-9`} />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={fieldCls}><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className={fieldCls}><option value="">All years</option>{YEARS.map((y) => <option key={y} value={y}>Year {y}</option>)}</select>
      </div>

      {isLoading ? <Spinner /> : error ? <p className="text-danger">{error.message}</p> : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Roll no.</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Year / Sec</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No students match.</td></tr>}
              {list.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono text-xs">{s.roll_number}</td>
                  <td className="px-4 py-3 font-medium">{s.name}{s.is_sample && <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">Sample</span>}</td>
                  <td className="px-4 py-3">{s.department}</td>
                  <td className="px-4 py-3">Year {s.year} · {s.section}</td>
                  <td className="px-4 py-3 text-right">
                    <button aria-label="Edit" className="rounded-lg p-2 hover:bg-accent" onClick={() => { setEditing(s); setForm({ name: s.name, roll_number: s.roll_number, department: s.department, year: s.year, section: s.section }); }}><Pencil className="h-4 w-4" /></button>
                    <button aria-label="Delete" className="rounded-lg p-2 text-danger hover:bg-danger-soft" onClick={() => confirm(`Delete ${s.name}? Their attendance will also be removed.`) && del.mutate(s.id)}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setForm(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="card-surface w-full max-w-md space-y-4 p-6 animate-rise">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{editing ? "Edit student" : "Add student"}</h2><button type="button" onClick={() => setForm(null)}><X className="h-5 w-5" /></button></div>
            <label className="block text-sm font-medium">Student name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${fieldCls} mt-1`} /></label>
            <label className="block text-sm font-medium">Roll number<input required maxLength={30} value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} className={`${fieldCls} mt-1`} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm font-medium">Department<select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={`${fieldCls} mt-1`}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></label>
              <label className="text-sm font-medium">Year<select value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={`${fieldCls} mt-1`}>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
              <label className="text-sm font-medium">Section<select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} className={`${fieldCls} mt-1`}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
