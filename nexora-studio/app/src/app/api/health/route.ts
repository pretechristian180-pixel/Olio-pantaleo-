import { isSupabaseConfigured } from "@/lib/env";

export function GET() {
  return Response.json({
    status: "ok",
    service: "nexora-studio",
    supabase: isSupabaseConfigured() ? "configured" : "missing",
  });
}
