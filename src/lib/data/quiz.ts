export interface QuizOption {
  id: string;
  label: string;
  tags: string[];
}

export interface QuizQuestion {
  id: string;
  domanda: string;
  opzioni: QuizOption[];
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: "uso",
    domanda: "Come lo utilizzi principalmente?",
    opzioni: [
      { id: "cucinare", label: "Per cucinare ogni giorno", tags: ["cucinare", "quotidiano"] },
      { id: "crudo", label: "Per condire a crudo", tags: ["crudo", "speciale"] },
      { id: "regalo", label: "Per regalare o stupire un ospite", tags: ["regalo", "speciale"] },
      { id: "scoprire", label: "Per scoprire un sapore nuovo", tags: ["scoprire", "speciale"] },
    ],
  },
  {
    id: "gusto",
    domanda: "Quali sapori preferisci?",
    opzioni: [
      { id: "delicato", label: "Delicato e morbido", tags: ["delicato"] },
      { id: "equilibrato", label: "Equilibrato, fruttato medio", tags: ["equilibrato"] },
      { id: "intenso", label: "Intenso, amaro e piccante deciso", tags: ["intenso"] },
      { id: "aromatico", label: "Aromatico — agrumi, erbe o spezie", tags: ["aromatico"] },
    ],
  },
  {
    id: "piatti",
    domanda: "Cosa cucini più spesso?",
    opzioni: [
      { id: "famiglia", label: "Piatti quotidiani, anche per bambini", tags: ["quotidiano", "delicato"] },
      { id: "pesce", label: "Pesce e piatti crudi", tags: ["crudo", "equilibrato"] },
      { id: "carne", label: "Carne e sapori decisi", tags: ["intenso"] },
      { id: "verdure", label: "Verdure, legumi, cucina mediterranea", tags: ["equilibrato", "crudo"] },
    ],
  },
  {
    id: "occasione",
    domanda: "Cerchi un olio quotidiano o speciale?",
    opzioni: [
      { id: "quotidiano", label: "Quotidiano, per tutti i giorni", tags: ["quotidiano"] },
      { id: "speciale", label: "Speciale, per occasioni particolari", tags: ["speciale", "regalo"] },
    ],
  },
];

export interface QuizProductProfile {
  slug: string;
  tags: string[];
}

export const quizProfiles: QuizProductProfile[] = [
  { slug: "zero", tags: ["delicato", "quotidiano", "cucinare"] },
  { slug: "100-italiano", tags: ["equilibrato", "quotidiano", "cucinare"] },
  { slug: "biologico", tags: ["equilibrato", "crudo", "regalo"] },
  { slug: "igp-puglia", tags: ["intenso", "crudo", "cucinare"] },
  { slug: "rusticano", tags: ["intenso", "cucinare"] },
  { slug: "selezione-oro", tags: ["equilibrato", "crudo", "regalo", "speciale"] },
  { slug: "oronovo", tags: ["intenso", "speciale", "scoprire"] },
  { slug: "bio-young", tags: ["intenso", "crudo", "scoprire"] },
  { slug: "aromatizzato-limone", tags: ["aromatico", "crudo", "regalo", "scoprire"] },
  { slug: "aromatizzato-peperoncino", tags: ["aromatico", "cucinare", "intenso"] },
  { slug: "aromatizzato-basilico", tags: ["aromatico", "crudo", "regalo"] },
  { slug: "aromatizzato-aglio", tags: ["aromatico", "cucinare", "quotidiano"] },
  { slug: "kit-degustazione", tags: ["scoprire", "regalo", "speciale"] },
];

export function computeQuizResult(selectedTags: string[]): string {
  let bestSlug = "100-italiano";
  let bestScore = -1;

  for (const profile of quizProfiles) {
    const score = profile.tags.reduce(
      (acc, tag) => acc + (selectedTags.includes(tag) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestSlug = profile.slug;
    }
  }

  return bestSlug;
}
