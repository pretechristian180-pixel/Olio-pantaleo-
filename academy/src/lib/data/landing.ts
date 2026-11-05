import "server-only";
import { cache } from "react";
import { parseSections, type Brief, type Section } from "@/lib/landing/sections";
import { createClient } from "@/lib/supabase/server";

export type Landing = {
  stato: "draft" | "published";
  sezioni: Section[];
  brief: Partial<Brief>;
  generataIl: string | null;
};

/** Landing del corso: le RLS mostrano a tutti quelle pubblicate, allo staff anche le bozze. */
export const getLanding = cache(async (courseId: string): Promise<Landing | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("landing_pages")
    .select("stato, sezioni, brief, generata_il")
    .eq("course_id", courseId)
    .maybeSingle();
  if (!data) return null;
  return {
    stato: data.stato as Landing["stato"],
    sezioni: parseSections(data.sezioni),
    brief: (data.brief ?? {}) as Partial<Brief>,
    generataIl: data.generata_il as string | null,
  };
});
