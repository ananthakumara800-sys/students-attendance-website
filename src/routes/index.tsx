import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, CalendarCheck, Users } from "lucide-react";
import { Shell } from "@/components/Shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rollcall — Student attendance, simplified" },
      { name: "description", content: "Admins set up classes, teachers mark attendance in seconds, and students see their own record anytime." },
      { property: "og:title", content: "Rollcall — Student attendance, simplified" },
      { property: "og:description", content: "Every student, accounted for. Simple attendance for admins, teachers and students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const roles = [
  { icon: ShieldCheck, title: "Admins", text: "Create classes, assign teachers and enroll students.", box: "bg-panel-navy border-border", ic: "text-primary" },
  { icon: CalendarCheck, title: "Teachers", text: "Mark present, absent or late for any day.", box: "bg-panel-red border-primary/50", ic: "text-hero-red" },
  { icon: Users, title: "Students", text: "View your attendance history and percentage.", box: "bg-panel-blue border-hero-blue/40", ic: "text-hero-blue" },
];

function Index() {
  return (
    <Shell>
      <main className="pb-24 pt-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Attendance, simplified</p>
        <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Every student,
          <br />
          <span className="text-hero-gradient italic pr-2">accounted for.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Admins set up classes, teachers mark attendance in seconds, and students see their own record anytime.
        </p>
        <Link to="/auth" className="mt-10 inline-flex rounded-lg bg-primary px-8 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Get started
        </Link>
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {roles.map((r) => (
            <div key={r.title} className={`rounded-2xl border p-6 backdrop-blur ${r.box}`}>
              <r.icon className={`h-8 w-8 ${r.ic}`} />
              <h3 className="mt-5 text-xl font-semibold">{r.title}</h3>
              <p className="mt-2 text-muted-foreground">{r.text}</p>
            </div>
          ))}
        </div>
      </main>
    </Shell>
  );
}
