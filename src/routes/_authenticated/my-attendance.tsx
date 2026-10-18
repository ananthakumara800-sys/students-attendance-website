import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Spinner } from "@/components/PageHeader";
import { attendancePercent, isLowAttendance, LOW_ATTENDANCE_THRESHOLD } from "@/lib/attendance";
import type { Student, AttendanceRow } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/my-attendance")({
  head: () => ({ meta: [{ title: "My Attendance — Rollcall" }, { name: "description", content: "Your attendance history and totals." }] }),
  component: MyAttendance,
});

async function fetchMine() {
  const { data: u } = await supabase.auth.getUser();
  const email = u.user?.email ?? "";
  const { data: st, error } = await supabase.from("students").select("*").ilike("email", email).maybeSingle();
  if (error) throw error;
  if (!st) return { student: null, rows: [] as AttendanceRow[] };
  const { data: rows, error: e2 } = await supabase.from("attendance").select("id,student_id,date,status,created_at").eq("student_id", st.id).order("date", { ascending: false });
  if (e2) throw e2;
  return { student: st as Student, rows: rows as AttendanceRow[] };
}

function MyAttendance() {
  const { data, isLoading, error } = useQuery({ queryKey: ["my-attendance"], queryFn: fetchMine });
  if (isLoading) return <Spinner />;
  if (error) return <p className="text-danger">{error.message}</p>;
  if (!data?.student) return <div className="card-surface p-8 text-center text-muted-foreground">No student record is linked to your email yet. Ask your administrator.</div>;

  const { student, rows } = data;
  const attended = rows.filter((r) => r.status === "present").length;
  const pct = attendancePercent(attended, rows.length);
  const low = isLowAttendance(pct, rows.length);
  const months = new Map<string, { a: number; t: number }>();
  rows.forEach((r) => { const k = r.date.slice(0, 7); const m = months.get(k) ?? { a: 0, t: 0 }; m.t++; if (r.status === "present") m.a++; months.set(k, m); });

  return (
    <>
      <PageHeader title="My Attendance" subtitle={`${student.name} · ${student.roll_number} · ${student.department} Year ${student.year}-${student.section}`} />
      {low && <div className="mb-4 flex items-center gap-3 rounded-xl border border-warning bg-warning-soft p-4 text-sm"><AlertTriangle className="h-5 w-5 text-warning" />Your attendance is below {LOW_ATTENDANCE_THRESHOLD}%. Please attend more classes.</div>}
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Classes conducted", rows.length], ["Attended", attended], ["Missed", rows.length - attended], ["Attendance", `${pct}%`]].map(([l, v]) => (
          <div key={l} className="card-surface p-5"><p className="text-sm text-muted-foreground">{l}</p><p className={`mt-1 text-3xl font-bold ${l === "Attendance" ? (low ? "text-danger" : "text-success") : ""}`}>{v}</p></div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card-surface p-5">
          <h2 className="mb-3 font-semibold">By month</h2>
          {[...months].map(([k, m]) => <div key={k} className="flex justify-between border-t border-border py-2 text-sm"><span>{k}</span><span>{m.a}/{m.t} · {attendancePercent(m.a, m.t)}%</span></div>)}
        </div>
        <div className="card-surface overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No attendance recorded yet.</td></tr>}
              {rows.map((r) => <tr key={r.id} className="border-t border-border"><td className="px-4 py-3">{r.date}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "present" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{r.status}</span></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
