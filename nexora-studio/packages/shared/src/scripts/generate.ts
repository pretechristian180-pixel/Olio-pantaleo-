import type { ProviderCost } from "../domain.js";
import type { LLMProvider } from "../providers/llm.js";
import { weekContext } from "./calendar.js";
import {
  type BrandContext,
  type PastScript,
  regenerateUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
  weeklyUserPrompt,
} from "./prompt.js";
import { type ScriptDraft, SingleScriptSchema, WeeklyScriptsSchema } from "./schema.js";
import { findRepetitions } from "./similarity.js";

export interface GenerationResult<T> {
  value: T;
  costs: ProviderCost[];
  model: string;
}

const clamp = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Normalizza i campi che lo schema non può limitare (lunghezze, numeri). */
export function normalizeDraft(d: ScriptDraft): ScriptDraft {
  return {
    ...d,
    title: clamp(d.title.trim(), 80),
    hook: clamp(d.hook.trim(), 160),
    body: d.body.trim(),
    call_to_action: d.call_to_action.trim(),
    topic_tags: d.topic_tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 4),
    shooting_notes: {
      ...d.shooting_notes,
      duration_seconds: Math.min(90, Math.max(15, Math.round(d.shooting_notes.duration_seconds || 45))),
      tips: d.shooting_notes.tips.map((t) => t.trim()).filter(Boolean).slice(0, 4),
    },
  };
}

/**
 * Genera gli script della settimana.
 * Anti-ripetizione in due livelli: il modello riceve gli script delle ultime settimane, e dopo
 * un controllo di somiglianza sostituisce quelli troppo vicini (al massimo `maxFixRounds` giri).
 */
export async function generateWeeklyScripts(
  llm: LLMProvider,
  args: { brand: BrandContext; weekStart: string; count: number; past: PastScript[]; maxFixRounds?: number },
): Promise<GenerationResult<ScriptDraft[]>> {
  const calendar = weekContext(args.weekStart, 21, args.brand.sector);
  const costs: ProviderCost[] = [];

  const first = await llm.generateObject({
    system: SCRIPT_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: weeklyUserPrompt({ ...args, calendar }) },
    ],
    schema: WeeklyScriptsSchema,
    effort: "medium",
  });
  costs.push(first.cost);
  let drafts = first.data.scripts.map(normalizeDraft).slice(0, args.count);

  const pastComparable = args.past.map((p) => ({ title: p.title, hook: p.hook, topicTags: p.topicTags }));
  const toComparable = (d: ScriptDraft) => ({ title: d.title, hook: d.hook, topicTags: d.topic_tags });

  for (let round = 0; round < (args.maxFixRounds ?? 2); round++) {
    const missing = args.count - drafts.length;
    const repeated = findRepetitions(drafts.map(toComparable), pastComparable);
    if (repeated.length === 0 && missing <= 0) break;

    const repeatedIdx = new Set(repeated.map((r) => r.index));
    const keep = drafts.filter((_, i) => !repeatedIdx.has(i));
    const needed = args.count - keep.length;

    const fix = await llm.generateObject({
      system: SCRIPT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: weeklyUserPrompt({
            ...args,
            count: needed,
            calendar,
            past: [
              ...args.past,
              ...keep.map((k) => ({ weekStart: args.weekStart, title: k.title, hook: k.hook, topicTags: k.topic_tags })),
              ...repeated.map((r) => ({
                weekStart: args.weekStart,
                title: drafts[r.index]!.title,
                hook: drafts[r.index]!.hook,
                topicTags: drafts[r.index]!.topic_tags,
              })),
            ],
          }),
        },
      ],
      schema: WeeklyScriptsSchema,
      effort: "medium",
    });
    costs.push(fix.cost);
    drafts = [...keep, ...fix.data.scripts.map(normalizeDraft).slice(0, needed)];
  }

  if (drafts.length === 0) throw new Error("Nessuno script generato");
  return { value: drafts, costs, model: first.model };
}

/** Rigenera un singolo script della settimana, diverso dagli altri e dal precedente. */
export async function regenerateScript(
  llm: LLMProvider,
  args: {
    brand: BrandContext;
    weekStart: string;
    current: { title: string; hook: string; format: string };
    siblings: { title: string; hook: string }[];
    past: PastScript[];
    feedback?: string;
  },
): Promise<GenerationResult<ScriptDraft>> {
  const calendar = weekContext(args.weekStart, 21, args.brand.sector);
  const res = await llm.generateObject({
    system: SCRIPT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: regenerateUserPrompt({ ...args, calendar }) }],
    schema: SingleScriptSchema,
    effort: "medium",
  });
  return { value: normalizeDraft(res.data.script), costs: [res.cost], model: res.model };
}
