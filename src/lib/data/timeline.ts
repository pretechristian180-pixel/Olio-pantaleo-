export interface TimelineEvent {
  year: string;
  eyebrow: string;
  title: string;
  text: string;
}

export const timeline: TimelineEvent[] = [
  {
    year: "1890",
    eyebrow: "Terra",
    title: "Le prime piante, a Fasano",
    text: "La famiglia Pantaleo inizia a lavorare la terra tra gli uliveti della Valle d'Itria, in provincia di Brindisi. Il frantoio è ancora un'attività al servizio della famiglia e dei vicini di campagna.",
  },
  {
    year: "1930-1950",
    eyebrow: "Famiglia",
    title: "Dal frantoio di paese all'attività di famiglia",
    text: "La seconda generazione trasforma il piccolo frantoio in un'attività strutturata, che comincia a servire i primi clienti fuori dal paese. La molitura resta legata ai ritmi della raccolta e delle stagioni.",
  },
  {
    year: "1960-1980",
    eyebrow: "Esperienza",
    title: "La terza generazione e i primi mercati",
    text: "L'azienda cresce insieme al boom dei consumi in Italia. Pantaleo inizia a imbottigliare con un proprio marchio e a raggiungere le prime tavole fuori dalla Puglia.",
  },
  {
    year: "1990-2010",
    eyebrow: "Esperienza",
    title: "Investimenti in qualità e tracciabilità",
    text: "Nuovi impianti di estrazione a freddo, controlli di qualità più rigorosi e l'avvio dei rapporti con la grande distribuzione e i primi mercati esteri.",
  },
  {
    year: "Oggi",
    eyebrow: "Innovazione",
    title: "La quarta generazione, tra tradizione e digitale",
    text: "Oggi Pantaleo è guidata dalla quarta generazione della famiglia, che affianca al lavoro in frantoio un percorso di innovazione: nuove linee di prodotto, agricoltura biologica, e un rapporto diretto con chi sceglie il nostro olio ogni giorno.",
  },
];
