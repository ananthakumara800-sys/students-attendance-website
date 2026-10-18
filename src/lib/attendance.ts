export type Status = "present" | "absent";

export const LOW_ATTENDANCE_THRESHOLD = 75;

/** Attendance % = attended / conducted × 100, rounded to 1 decimal. 0 classes → 0. */
export function attendancePercent(attended: number, conducted: number): number {
  if (conducted <= 0) return 0;
  return Math.round((attended / conducted) * 1000) / 10;
}

export function isLowAttendance(percent: number, conducted: number): boolean {
  return conducted > 0 && percent < LOW_ATTENDANCE_THRESHOLD;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIDS"];
export const YEARS = [1, 2, 3, 4];
export const SECTIONS = ["A", "B", "C", "D"];
