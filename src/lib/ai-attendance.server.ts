import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export type RosterEntry = { id: string; name: string; roll_number: string };
export type Suggestion = { student_id: string; status: "present" | "absent"; reason: string };

export async function suggestAttendance(roster: RosterEntry[], notes: string): Promise<Suggestion[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured for this app.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system:
      "You help a college teacher record attendance. Given a class roster and the teacher's free-text notes, decide for EVERY roster student whether they were present or absent. " +
      "Students not mentioned as absent/missing/on leave are present unless the notes say otherwise (e.g. 'only X and Y came'). Match names and roll numbers loosely (nicknames, partial names, last digits of roll numbers). " +
      'Reply with json only: {"suggestions":[{"student_id":"<id>","status":"present"|"absent","reason":"short reason"}]}. Use only ids from the roster.',
    messages: [{ role: "user", content: `Roster (json):\n${JSON.stringify(roster)}\n\nTeacher notes:\n${notes}` }],
    maxRetries: 0,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
        textFormat: undefined,
      },
    },
  });

  let text: string;
  try {
    text = await result.text;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 429) throw new Error("The AI is busy right now. Please try again in a minute.");
    if (status === 402) throw new Error("AI credits have run out. Please add credits in workspace billing.");
    throw new Error("The AI could not process these notes. Please try again.");
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The AI returned an unexpected answer. Try rephrasing your notes.");
  const parsed = JSON.parse(match[0]) as { suggestions?: Suggestion[] };
  const ids = new Set(roster.map((r) => r.id));
  return (parsed.suggestions ?? []).filter((s) => ids.has(s.student_id) && (s.status === "present" || s.status === "absent"));
}
