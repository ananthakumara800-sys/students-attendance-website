import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Sparkles, X, Save } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Spinner, btnGhost, btnPrimary, fieldCls } from "@/components/PageHeader";
import { fetchStudents, studentsKey } from "@/lib/data";
import { today, type Status } from "@/lib/attendance";
import { useMyRole } from "@/lib/role";
import { fetchClasses } from "./classes";
import { suggestAttendanceFn } from "@/lib/ai-attendance.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Mark Attendance — Rollcall" }, { name: "description", content: "Mark daily attendance by class." }] }),
  component: MarkAttendance,
});

function MarkAttendance() {
  const qc = useQueryClient();
  const me = useMyRole();
  const cls = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const students = useQuery({ queryKey: studentsKey, queryFn: fetchStudents });
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [existing, setExisting] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const suggest = useServerFn(suggestAttendanceFn);

  const myClasses = useMemo(() => {
    const all = cls.data?.classes ?? [];
    return me.data?.role === "admin" ? all : all.filter((c) => c.teacher_id === me.data?.userId);
  }, [cls.data, me.data]);

  const roster = useMemo(() => {
    const ids = new Set((cls.data?.roster ?? []).filter((r) => r.class_id === classId).map((r) => r.student_id));
    return (students.data ?? []).filter((s) => ids.has(s.id));
  }, [cls.data, students.data, classId]);

  useEffect(() => {
    if (!classId || roster.length === 0) { setMarks({}); return; }
    setLoadingDay(true);
    setReasons({});
    supabase.from("attendance").select("student_id,status").eq("date", date).in("student_id", roster.map((s) => s.id))
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        const m: Record<string, Status> = {};
        roster.forEach((s) => (m[s.id] = "present"));
        (data ?? []).forEach((r) => (m[r.student_id] = r.status as Status));
        setExisting((data ?? []).length > 0);
        setMarks(m);
        setLoadingDay(false);
      });
  }, [classId, date, roster]);

  async function save() {
    if (date > today()) { toast.error("You can't mark attendance for a future date."); return; }
    setSaving(true);
    const rows = roster.map((s) => ({ student_id: s.id, date, status: marks[s.id] ?? "present", marked_by: me.data?.userId ?? null }));
    // upsert on (student_id, date) prevents duplicate entries for the same day
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    setSaving(false);
    if (error) { toast.error(error.message.includes("row-level security") ? "You can only mark attendance for your own classes." : error.message); return; }
    setExisting(true);
    toast.success(`Attendance saved for ${rows.length} students`);
    qc.invalidateQueries({ queryKey: ["attendance"] });
  }

  async function runAi() {
    if (!notes.trim()) { toast.error("Write a few notes first, e.g. “Rohan and Priya absent, Meera on leave”."); return; }
    setAiBusy(true);
    try {
      const { suggestions } = await suggest({ data: { roster: roster.map((s) => ({ id: s.id, name: s.name, roll_number: s.roll_number })), notes } });
      if (!suggestions.length) { toast.error("The AI couldn't match anyone. Try naming students more clearly."); return; }
      const m = { ...marks }, r: Record<string, string> = {};
      suggestions.forEach((s) => { m[s.student_id] = s.status; r[s.student_id] = s.reason; });
      setMarks(m); setReasons(r);
      toast.success("Suggestions applied — review them, then press Save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally { setAiBusy(false); }
  }

  if (cls.isLoading || students.isLoading || me.isLoading) return <Spinner />;
  const present = roster.filter((s) => marks[s.id] === "present").length;

  return (
    <>
      <PageHeader title="Mark Attendance" subtitle="Choose a class and date, then mark each student" />
      <div className="card-surface mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${fieldCls} mt-1`}>
            <option value="">Select a class…</option>
            {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.department} {c.year}-{c.section}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Date<input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldCls} mt-1`} /></label>
      </div>
      {myClasses.length === 0 && <p className="card-surface p-8 text-center text-muted-foreground">No classes are assigned to you yet.</p>}

      {classId && (loadingDay ? <Spinner /> : roster.length === 0 ? <p className="card-surface p-8 text-center text-muted-foreground">This class has no students yet.</p> : (
        <>
          <div className="card-surface mb-4 p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />AI helper</div>
            <p className="mb-3 text-sm text-muted-foreground">Type your notes in plain words and AI will suggest who was present or absent. You can change anything before saving.</p>
            <textarea value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. Rohan and Priya were absent, Meera came late, everyone else present" className={fieldCls} />
            <button onClick={runAi} disabled={aiBusy} className={`${btnGhost} mt-3`}><Sparkles className="h-4 w-4" />{aiBusy ? "Thinking…" : "Suggest attendance"}</button>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold text-success">{present} present</span> · <span className="font-semibold text-danger">{roster.length - present} absent</span>
              {existing && <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">Already saved — saving will update</span>}
            </p>
            <div className="flex gap-2">
              <button className={btnGhost} onClick={() => setMarks(Object.fromEntries(roster.map((s) => [s.id, "present"])))}>All present</button>
              <button className={btnPrimary} onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving…" : "Save attendance"}</button>
            </div>
          </div>
          <div className="card-surface divide-y divide-border">
            {roster.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{s.roll_number}{reasons[s.id] && <span className="ml-2 font-sans italic text-primary">AI: {reasons[s.id]}</span>}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMarks({ ...marks, [s.id]: "present" })} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${marks[s.id] === "present" ? "bg-success text-primary-foreground" : "bg-success-soft text-success"}`}><Check className="h-4 w-4" />Present</button>
                  <button onClick={() => setMarks({ ...marks, [s.id]: "absent" })} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${marks[s.id] === "absent" ? "bg-danger text-primary-foreground" : "bg-danger-soft text-danger"}`}><X className="h-4 w-4" />Absent</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ))}
    </>
  );
}
