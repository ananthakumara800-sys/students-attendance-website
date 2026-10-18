import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "teacher" | "student" | null;

export async function fetchMyRole(): Promise<{ role: Role; userId: string; email: string }> {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user!;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map((r) => r.role as string);
  const role: Role = roles.includes("admin") ? "admin" : roles.includes("teacher") ? "teacher" : roles.includes("student") ? "student" : null;
  return { role, userId: user.id, email: user.email ?? "" };
}

export function useMyRole() {
  return useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole, staleTime: 60_000 });
}
