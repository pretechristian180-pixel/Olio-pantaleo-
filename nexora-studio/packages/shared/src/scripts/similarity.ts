/** Somiglianza tra testi brevi (titoli e hook) per bloccare le ripetizioni tra settimane. */

const STOPWORDS = new Set(
  "il lo la i gli le un uno una di a da in con su per tra fra e o ma che chi non è sono ho hai ha come del della dei delle al alla ai alle nel nella si ti mi ci vi tu io noi voi questo questa quello quella più meno anche già solo ecco".split(
    " ",
  ),
);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      // radice grezza: "pizze" ~ "pizza", "impasti" ~ "impasto"
      .map((w) => (w.length > 5 ? w.slice(0, -1) : w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface Comparable {
  title: string;
  hook: string;
  topicTags?: string[];
}

/** Punteggio 0..1: il massimo tra somiglianza di titolo, hook e temi. */
export function similarity(a: Comparable, b: Comparable) {
  const title = jaccard(tokens(a.title), tokens(b.title));
  const hook = jaccard(tokens(a.hook), tokens(b.hook));
  const tags =
    a.topicTags?.length && b.topicTags?.length
      ? jaccard(new Set(a.topicTags.map((t) => t.toLowerCase())), new Set(b.topicTags.map((t) => t.toLowerCase())))
      : 0;
  return Math.max(title, hook, tags);
}

export const REPETITION_THRESHOLD = 0.6;

/** Indici degli script troppo simili a uno passato o a uno precedente della stessa lista. */
export function findRepetitions(drafts: Comparable[], past: Comparable[], threshold = REPETITION_THRESHOLD) {
  const bad: { index: number; similarTo: string; score: number }[] = [];
  drafts.forEach((d, i) => {
    const others = [...past, ...drafts.slice(0, i)];
    let best = { score: 0, title: "" };
    for (const o of others) {
      const s = similarity(d, o);
      if (s > best.score) best = { score: s, title: o.title };
    }
    if (best.score >= threshold) bad.push({ index: i, similarTo: best.title, score: best.score });
  });
  return bad;
}
