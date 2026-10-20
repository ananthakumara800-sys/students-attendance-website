import { supabase } from "@/integrations/supabase/client";
import type { Status } from "./attendance";

export type Student = {
  id: string; name: string; roll_number: string; department: string;
  year: number; section: string; is_sample: boolean; email: string | null;
};
export type AttendanceRow = { id: string; student_id: string; date: string; status: Status; created_at: string };

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from("students").select("*").order("roll_number");
  if (error) throw error;
  return data as Student[];
}

export async function fetchAttendance(from?: string, to?: string): Promise<AttendanceRow[]> {
  let q = supabase.from("attendance").select("id,student_id,date,status,created_at").order("date", { ascending: false });
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data, error } = await q.limit(10000);
  if (error) throw error;
  return data as AttendanceRow[];
}

export const studentsKey = ["students"] as const;
export const attendanceKey = (from?: string, to?: string) => ["attendance", from ?? "", to ?? ""] as const;
