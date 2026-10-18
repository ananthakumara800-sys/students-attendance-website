import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const suggestAttendanceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      roster: z.array(z.object({ id: z.string().uuid(), name: z.string().max(200), roll_number: z.string().max(50) })).min(1).max(300),
      notes: z.string().trim().min(1, "Please write some notes").max(4000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { suggestAttendance } = await import("./ai-attendance.server");
    return { suggestions: await suggestAttendance(data.roster, data.notes) };
  });
