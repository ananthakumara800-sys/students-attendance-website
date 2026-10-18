import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, Search } from "lucide-react";
import { PageHeader, Spinner, btnGhost, fieldCls } from "@/components/PageHeader";
import { attendanceKey, fetchAttendance, fetchStudents, studentsKey } from "@/lib/data";
import { attendancePercent, downloadCsv, isLowAttendance, today, LOW_ATTENDANCE_THRESHOLD } from "@/lib/attendance";
import { fetchClasses } from "./classes";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Attendance Reports — Rollcall" }, { name: "description", content: "Daily, monthly and student attendance reports." }] }),
  component: Reports,
});

type Tab = "daily" | "monthly" | "student";

function Reports() {
  const [tab, setTab] = useState<Tab>("monthly");
  const [day, setDay] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [classId, setClassId] = useState("");
  const [q, setQ] = useState("");
  const [studentId, setStudentId] = useState("");

  const students = useQuery({ queryKey: studentsKey, queryFn: fetchStudents });
  const cls = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const att = useQuery({ queryKey: attendanceKey(), queryFn: () => fetchAttendance() });

  const filteredStudents = useMemo(() => {
    const inClass = classId ? new Set(cls.data?.roster.filter((r) => r.class_id === classId).map((r) => r.student_id)) : null;
    return (students.data ?? []).filter((s) => (!inClass || inClass.has(s.id)) &&
      (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.roll_number.toLowerCase().includes(q.toLowerCase())));
  }, [students.data, cls.data, classId, q]);

  if (students.isLoading || att.isLoading || cls.isLoading) return <Spinner />;
  const all = att.data ?? [];

  const daily = filteredStudents.map((s) => ({ s, status: all.find((r) => r.student_id === s.id && r.date === day)?.status ?? "—" }));
  const monthly = filteredStudents.map((s) => {
    const rows = all.filter((r) => r.student_id === s.id && r.date.startsWith(month));
    const attended = rows.filter((r) => r.status === "present").length;
    return { s, conducted: rows.length, attended, pct: attendancePercent(attended, rows.length) };
  });
  const history = all.filter((r) => r.student_id === studentId).sort((a, b) => b.date.localeCompare(a.date));
  const histAttended = history.filter((r) => r.status === "present").length;
  const histPct = attendancePercent(histAttended, history.length);
  const sel = students.data?.find((s) => s.id === studentId);

  function exportCsv() {
    if (tab === "daily") downloadCsv(`attendance-${day}.csv`, [["Roll no", "Name", "Department", "Year", "Section", "Status"], ...daily.map(({ s, status }) => [s.roll_number, s.name, s.department, s.year, s.section, status])]);
    else if (tab === "monthly") downloadCsv(`attendance-${month}.csv`, [["Roll no", "Name", "Classes conducted", "Attended", "Percentage"], ...monthly.map((m) => [m.s.roll_number, m.s.name, m.conducted, m.attended, m.pct])]);
    else if (sel) downloadCsv(`attendance-${sel.roll_number}.csv`, [["Date", "Status"], ...history.map((r) => [r.date, r.status])]);
  }

  const pill = (st: string) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st === "present" ? "bg-success-soft text-success" : st === "absent" ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground"}`}>{st}</span>;
  const low = monthly.filter((m) => isLowAttendance(m.pct, m.conducted));

  return (
    <>
      <PageHeader title="Attendance Reports" subtitle="Filter, review and download attendance"
        action={<button className={btnGhost} onClick={exportCsv} disabled={tab === "student" && !sel}><Download className="h-4 w-4" />Download CSV</button>} />
      <div className="mb-4 inline-flex rounded-xl bg-muted p-1">
        {(["daily", "monthly", "student"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-card shadow-card" : "text-muted-foreground"}`}>{t === "student" ? "Student history" : t}</button>
        ))}
      </div>

      <div className="card-surface mb-4 grid gap-3 p-4 md:grid-cols-3">
        {tab === "daily" && <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={fieldCls} />}
        {tab === "monthly" && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={fieldCls} />}
        {tab !== "student" ? (
          <>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={fieldCls}><option value="">All classes</option>{cls.data?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input placeholder="Name or roll number" value={q} onChange={(e) => setQ(e.target.value)} className={`${fieldCls} pl-9`} /></div>
          </>
        ) : (
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={`${fieldCls} md:col-span-3`}><option value="">Choose a student…</option>{students.data?.map((s) => <option key={s.id} value={s.id}>{s.roll_number} — {s.name}</option>)}</select>
        )}
      </div>

      {tab === "monthly" && low.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning bg-warning-soft p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <p><b>{low.length} student{low.length > 1 ? "s" : ""}</b> below {LOW_ATTENDANCE_THRESHOLD}% this month: {low.map((m) => m.s.name).join(", ")}</p>
        </div>
      )}

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            {tab === "daily" && <tr><th className="px-4 py-3">Roll no.</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Status</th></tr>}
            {tab === "monthly" && <tr><th className="px-4 py-3">Roll no.</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Conducted</th><th className="px-4 py-3">Attended</th><th className="px-4 py-3">%</th></tr>}
            {tab === "student" && <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th></tr>}
          </thead>
          <tbody>
            {tab === "daily" && daily.map(({ s, status }) => <tr key={s.id} className="border-t border-border"><td className="px-4 py-3 font-mono text-xs">{s.roll_number}</td><td className="px-4 py-3">{s.name}</td><td className="px-4 py-3">{s.department} {s.year}-{s.section}</td><td className="px-4 py-3">{pill(status)}</td></tr>)}
            {tab === "monthly" && monthly.map((m) => (
              <tr key={m.s.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs">{m.s.roll_number}</td><td className="px-4 py-3">{m.s.name}</td><td className="px-4 py-3">{m.conducted}</td><td className="px-4 py-3">{m.attended}</td>
                <td className="px-4 py-3"><span className={`font-semibold ${isLowAttendance(m.pct, m.conducted) ? "text-danger" : "text-success"}`}>{m.conducted ? `${m.pct}%` : "—"}</span>{isLowAttendance(m.pct, m.conducted) && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-warning" />}</td>
              </tr>
            ))}
            {tab === "student" && (!sel ? <tr><td colSpan={2} className="px-4 py-10 text-center text-muted-foreground">Choose a student to see their history.</td></tr> : (
              <>
                <tr className="border-t border-border bg-accent/40"><td className="px-4 py-3 font-semibold">{sel.name}: {histAttended}/{history.length} classes</td><td className={`px-4 py-3 font-bold ${isLowAttendance(histPct, history.length) ? "text-danger" : "text-success"}`}>{histPct}%{isLowAttendance(histPct, history.length) && " — below 75%"}</td></tr>
                {history.map((r) => <tr key={r.id} className="border-t border-border"><td className="px-4 py-3">{r.date}</td><td className="px-4 py-3">{pill(r.status)}</td></tr>)}
              </>
            ))}
            {((tab === "daily" && daily.length === 0) || (tab === "monthly" && monthly.length === 0)) && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No students match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
