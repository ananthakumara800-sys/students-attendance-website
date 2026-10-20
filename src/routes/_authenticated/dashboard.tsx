import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMyRole } from "@/lib/role";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserX, Percent, ClipboardCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { PageHeader, Spinner, btnPrimary } from "@/components/PageHeader";
import { attendanceKey, fetchAttendance, fetchStudents, studentsKey } from "@/lib/data";
import { attendancePercent, today } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Rollcall" }, { name: "description", content: "Attendance overview." }] }),
  component: Dashboard,
});

function Dashboard() {
  const me = useMyRole();
  if (me.data?.role === "student") return <Navigate to="/my-attendance" />;
  return <StaffDashboard />;
}

function StaffDashboard() {
  const from = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10);
  const students = useQuery({ queryKey: studentsKey, queryFn: fetchStudents });
  const att = useQuery({ queryKey: attendanceKey(from), queryFn: () => fetchAttendance(from) });

  if (students.isLoading || att.isLoading) return <Spinner />;
  if (students.error || att.error) return <p className="text-danger">Could not load data: {(students.error || att.error)?.message}</p>;

  const s = students.data!, a = att.data!;
  const t = today();
  const todays = a.filter((r) => r.date === t);
  const present = todays.filter((r) => r.status === "present").length;
  const absent = todays.length - present;
  const overall = attendancePercent(a.filter((r) => r.status === "present").length, a.length);
  const byName = new Map(s.map((x) => [x.id, x]));

  const days: { day: string; Present: number; Absent: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const rows = a.filter((r) => r.date === d);
    days.push({ day: new Date(d).toLocaleDateString(undefined, { weekday: "short" }), Present: rows.filter((r) => r.status === "present").length, Absent: rows.filter((r) => r.status === "absent").length });
  }

  const cards = [
    { label: "Total Students", value: s.length, icon: Users, cls: "bg-accent text-accent-foreground" },
    { label: "Present Today", value: present, icon: UserCheck, cls: "bg-success-soft text-success" },
    { label: "Absent Today", value: absent, icon: UserX, cls: "bg-danger-soft text-danger" },
    { label: "Attendance % (14 days)", value: `${overall}%`, icon: Percent, cls: "bg-secondary text-secondary-foreground" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Today's snapshot and weekly trends"
        action={<Link to="/attendance" className={btnPrimary}><ClipboardCheck className="h-4 w-4" />Mark attendance</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div key={c.label} className="card-surface p-5 animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${c.cls}`}><c.icon className="h-5 w-5" /></div>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Weekly attendance</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                <Legend />
                <Bar dataKey="Present" fill="var(--success)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Absent" fill="var(--danger)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-surface p-5">
          <h2 className="mb-4 font-semibold">Recent activity</h2>
          {a.length === 0 ? <p className="text-sm text-muted-foreground">No attendance yet.</p> : (
            <ul className="space-y-3">
              {[...a].sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{byName.get(r.student_id)?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.date}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "present" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
