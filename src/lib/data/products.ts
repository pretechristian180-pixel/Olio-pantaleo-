export type OilCategory =
  | "premium"
  | "aromatizzati"
  | "squeezable"
  | "kit-degustazione";

export const categoryLabels: Record<OilCategory, string> = {
  premium: "Oli Premium",
  aromatizzati: "Aromatizzati",
  squeezable: "Squeezable",
  "kit-degustazione": "Kit Assaggio",
};

export interface SensoryProfile {
  fruttato: number; // 1-5
  amaro: number;
  piccante: number;
  intensita: number;
}

export interface ProductVariant {
  id: string;
  formato: string;
  prezzo: number;
  disponibile: boolean;
}

export type UsoTag =
  | "Per cucinare"
  | "Per condire a crudo"
  | "Per regalare"
  | "Per scoprire"
  | "Per ogni giorno"
  | "Per gli appassionati";

export interface Product {
  slug: string;
  nome: string;
  categoria: OilCategory;
  referenza: string;
  badge?: string;
  tagline: string;
  descrizioneBreve: string;
  storytelling: string;
  origine: string;
  cultivar?: string;
  metodo?: string;
  sensoriale?: SensoryProfile;
  idealePer: UsoTag[];
  gusto: string[];
  formati: ProductVariant[];
  abbinamenti: string[];
  ricetteCorrelate: string[];
  prodottiCorrelati: string[];
  accent: "olive" | "gold" | "clay" | "forest";
}

export const products: Product[] = [
  {
    slug: "selezione-oro",
    nome: "Selezione Oro",
    categoria: "premium",
    referenza: "Selezione Oro",
    badge: "Alta selezione",
    tagline: "L'assemblaggio più esigente della casa Pantaleo.",
    descrizioneBreve:
      "Un blend di cultivar pugliesi scelte a una a una, per un equilibrio raro tra fruttato ed eleganza.",
    storytelling:
      "Selezione Oro nasce dal lavoro di assaggio più severo dell'annata: solo le partite che superano il nostro pannel interno entrano in questo blend. È l'olio che teniamo per gli occasioni importanti, e che da quattro generazioni rappresenta il punto più alto del nostro lavoro in frantoio.",
    origine: "Puglia, provincia di Brindisi e Fasano",
    cultivar: "Coratina, Ogliarola",
    metodo: "Estrazione a freddo, prima spremitura",
    sensoriale: { fruttato: 4, amaro: 3, piccante: 3, intensita: 4 },
    idealePer: ["Per condire a crudo", "Per regalare", "Per gli appassionati"],
    gusto: ["Fruttato medio", "Equilibrato", "Note di carciofo"],
    formati: [
      { id: "oro-250", formato: "250 ml", prezzo: 12.9, disponibile: true },
      { id: "oro-500", formato: "500 ml", prezzo: 18.9, disponibile: true },
      { id: "oro-750", formato: "750 ml", prezzo: 24.9, disponibile: true },
    ],
    abbinamenti: ["Tartare di pesce crudo", "Burrata e pomodori confit", "Bruschetta al pomodoro"],
    ricetteCorrelate: ["tartare-branzino-agrumi", "burrata-pomodori-confit"],
    prodottiCorrelati: ["igp-puglia", "100-italiano"],
    accent: "gold",
  },
  {
    slug: "igp-puglia",
    nome: "IGP Puglia",
    categoria: "premium",
    referenza: "IGP",
    badge: "IGP",
    tagline: "L'olio che porta il nome della nostra terra.",
    descrizioneBreve:
      "Olio extravergine a Indicazione Geografica Protetta Puglia, prodotto interamente con olive coltivate e frante nel territorio.",
    storytelling:
      "Ogni lotto IGP Puglia nasce da olive raccolte nei nostri uliveti e in quelli dei conferitori storici della zona di Fasano, frante entro poche ore dalla raccolta. È l'olio che meglio racconta il legame diretto tra la nostra famiglia e la terra che lavoriamo da oltre un secolo.",
    origine: "Puglia, area IGP",
    cultivar: "Coratina, Cima di Bitonto",
    metodo: "Spremitura a freddo entro 8 ore dalla raccolta",
    sensoriale: { fruttato: 4, amaro: 4, piccante: 4, intensita: 4 },
    idealePer: ["Per condire a crudo", "Per cucinare", "Per gli appassionati"],
    gusto: ["Fruttato intenso", "Erbaceo", "Piccante deciso"],
    formati: [
      { id: "igp-500", formato: "500 ml", prezzo: 15.9, disponibile: true },
      { id: "igp-750", formato: "750 ml", prezzo: 20.9, disponibile: true },
      { id: "igp-3l", formato: "3 L latta", prezzo: 49.9, disponibile: true },
    ],
    abbinamenti: ["Fave e cicorie", "Orecchiette alle cime di rapa", "Grigliata di verdure"],
    ricetteCorrelate: ["fave-cicorie", "orecchiette-cime-rapa"],
    prodottiCorrelati: ["rusticano", "selezione-oro"],
    accent: "olive",
  },
  {
    slug: "100-italiano",
    nome: "100% Italiano",
    categoria: "premium",
    referenza: "100% Italiano",
    badge: "100% Italiano",
    tagline: "Solo olive italiane, dalla raccolta al frantoio.",
    descrizioneBreve:
      "Un olio composto esclusivamente da olive di origine italiana, per chi cerca la massima tracciabilità della filiera.",
    storytelling:
      "In un mercato dove gran parte dell'olio in commercio nasce da miscele internazionali, abbiamo scelto di offrire una referenza garantita 100% italiana: tracciamo ogni partita dalla raccolta alla bottiglia, lavorando solo con conferitori del Sud Italia che conosciamo da anni.",
    origine: "Italia (Puglia, Calabria, Sicilia)",
    metodo: "Estrazione a freddo",
    sensoriale: { fruttato: 3, amaro: 3, piccante: 2, intensita: 3 },
    idealePer: ["Per ogni giorno", "Per cucinare", "Per condire a crudo"],
    gusto: ["Fruttato leggero", "Morbido", "Versatile"],
    formati: [
      { id: "ita-500", formato: "500 ml", prezzo: 11.9, disponibile: true },
      { id: "ita-1l", formato: "1 L", prezzo: 19.9, disponibile: true },
      { id: "ita-5l", formato: "5 L latta", prezzo: 74.9, disponibile: true },
    ],
    abbinamenti: ["Soffritto", "Insalate miste", "Zuppe di legumi"],
    ricetteCorrelate: ["zuppa-legumi-orto", "insalata-pugliese"],
    prodottiCorrelati: ["zero", "biologico"],
    accent: "olive",
  },
  {
    slug: "oronovo",
    nome: "OroNovo",
    categoria: "premium",
    referenza: "OroNovo",
    badge: "Edizione di annata",
    tagline: "L'olio nuovo, imbottigliato nei primi giorni di raccolta.",
    descrizioneBreve:
      "L'extravergine novello dell'annata: olive raccolte ancora verdi e frante entro poche ore, in edizione limitata da ottobre.",
    storytelling:
      "OroNovo è l'appuntamento che apre ogni nostra campagna olearia. Per pochi giorni all'anno frantiamo le prime olive ancora verdi della raccolta, per restituire un olio vivo, pungente, che racconta l'annata appena iniziata prima ancora che si sia conclusa.",
    origine: "Puglia, Fasano",
    cultivar: "Ogliarola raccolta verde",
    metodo: "Molitura entro 6 ore dalla raccolta, a bassa temperatura",
    sensoriale: { fruttato: 5, amaro: 4, piccante: 5, intensita: 5 },
    idealePer: ["Per gli appassionati", "Per regalare", "Per condire a crudo"],
    gusto: ["Fruttato verde", "Piccante vivo", "Note di erba appena tagliata"],
    formati: [
      { id: "oronovo-250", formato: "250 ml", prezzo: 14.9, disponibile: true },
      { id: "oronovo-500", formato: "500 ml", prezzo: 21.9, disponibile: true },
    ],
    abbinamenti: ["Fettunta", "Crudité di verdure invernali", "Zuppa di cavolo nero"],
    ricetteCorrelate: ["fettunta-oronovo"],
    prodottiCorrelati: ["igp-puglia", "selezione-oro"],
    accent: "forest",
  },
  {
    slug: "rusticano",
    nome: "Rusticano",
    categoria: "premium",
    referenza: "Rusticano",
    tagline: "Il carattere deciso dell'ulivo pugliese.",
    descrizioneBreve:
      "Un extravergine intenso e schietto, pensato per chi cerca il gusto pieno dell'oliva coratina.",
    storytelling:
      "Rusticano è il nostro omaggio alla tradizione contadina della Valle d'Itria: un olio senza compromessi, con l'amaro e il piccante che da sempre contraddistinguono la cultivar Coratina lavorata in purezza.",
    origine: "Puglia, Valle d'Itria",
    cultivar: "Coratina in purezza",
    metodo: "Estrazione a freddo",
    sensoriale: { fruttato: 4, amaro: 5, piccante: 5, intensita: 5 },
    idealePer: ["Per cucinare", "Per gli appassionati"],
    gusto: ["Amaro pieno", "Piccante deciso", "Struttura robusta"],
    formati: [
      { id: "rust-500", formato: "500 ml", prezzo: 13.9, disponibile: true },
      { id: "rust-1l", formato: "1 L", prezzo: 22.9, disponibile: true },
    ],
    abbinamenti: ["Carni alla brace", "Fagioli e cotiche", "Formaggi stagionati"],
    ricetteCorrelate: ["fagioli-cotiche"],
    prodottiCorrelati: ["igp-puglia", "oronovo"],
    accent: "clay",
  },
  {
    slug: "biologico",
    nome: "Biologico",
    categoria: "premium",
    referenza: "Biologico",
    badge: "Biologico",
    tagline: "Agricoltura biologica, lavorazione senza compromessi.",
    descrizioneBreve:
      "Olive da agricoltura biologica, lavorate negli stessi frantoi della nostra produzione storica.",
    storytelling:
      "La linea Biologico nasce dagli uliveti che abbiamo progressivamente convertito alla coltivazione biologica: niente concimi chimici di sintesi, gestione naturale del suolo, raccolta e molitura secondo lo stesso metodo che applichiamo da generazioni.",
    origine: "Puglia",
    metodo: "Agricoltura biologica, estrazione a freddo",
    sensoriale: { fruttato: 3, amaro: 3, piccante: 3, intensita: 3 },
    idealePer: ["Per ogni giorno", "Per condire a crudo", "Per regalare"],
    gusto: ["Fruttato equilibrato", "Pulito", "Armonico"],
    formati: [
      { id: "bio-500", formato: "500 ml", prezzo: 16.9, disponibile: true },
      { id: "bio-750", formato: "750 ml", prezzo: 21.9, disponibile: true },
    ],
    abbinamenti: ["Verdure al vapore", "Hummus e legumi", "Pesce al forno"],
    ricetteCorrelate: ["pesce-forno-agrumi"],
    prodottiCorrelati: ["bio-young", "zero"],
    accent: "olive",
  },
  {
    slug: "bio-young",
    nome: "Bio Young",
    categoria: "premium",
    referenza: "Bio Young",
    badge: "Biologico",
    tagline: "La raccolta biologica più precoce, in versione fruttato verde.",
    descrizioneBreve:
      "Olive biologiche raccolte in anticipo per un fruttato verde più marcato, vivace e aromatico.",
    storytelling:
      "Bio Young raccoglie la stessa filosofia biologica della nostra linea storica, anticipando la raccolta di alcune settimane: il risultato è un olio più verde, più aromatico, pensato per chi preferisce un fruttato deciso senza rinunciare alla coltivazione biologica.",
    origine: "Puglia",
    metodo: "Agricoltura biologica, raccolta anticipata",
    sensoriale: { fruttato: 5, amaro: 3, piccante: 4, intensita: 4 },
    idealePer: ["Per gli appassionati", "Per condire a crudo"],
    gusto: ["Fruttato verde intenso", "Aromatico", "Note erbacee"],
    formati: [{ id: "bioy-500", formato: "500 ml", prezzo: 17.9, disponibile: true }],
    abbinamenti: ["Carpaccio di verdure crude", "Minestre di verdura", "Formaggi freschi"],
    ricetteCorrelate: ["carpaccio-verdure-crude"],
    prodottiCorrelati: ["biologico", "oronovo"],
    accent: "forest",
  },
  {
    slug: "zero",
    nome: "Zero",
    categoria: "premium",
    referenza: "Zero",
    tagline: "Il gusto delicato, per chi si avvicina all'olio ogni giorno.",
    descrizioneBreve:
      "Un blend a fruttato leggero e amaro contenuto, pensato per l'uso quotidiano e per i palati più delicati.",
    storytelling:
      "Zero nasce per rispondere a una richiesta precisa dei nostri clienti: un olio extravergine autentico, ma con un profilo più morbido, adatto a chi cucina ogni giorno per tutta la famiglia, bambini compresi.",
    origine: "Puglia",
    metodo: "Selezione di partite a bassa intensità sensoriale",
    sensoriale: { fruttato: 2, amaro: 1, piccante: 1, intensita: 2 },
    idealePer: ["Per ogni giorno", "Per cucinare"],
    gusto: ["Delicato", "Morbido", "Facile da abbinare"],
    formati: [
      { id: "zero-500", formato: "500 ml", prezzo: 10.9, disponibile: true },
      { id: "zero-1l", formato: "1 L", prezzo: 17.9, disponibile: true },
    ],
    abbinamenti: ["Piatti per bambini", "Besciamella e vellutate", "Pesce al vapore"],
    ricetteCorrelate: ["vellutata-verdure"],
    prodottiCorrelati: ["100-italiano", "biologico"],
    accent: "olive",
  },
  {
    slug: "aromatizzato-limone",
    nome: "Aromatizzato al Limone",
    categoria: "aromatizzati",
    referenza: "Aromatizzati",
    tagline: "Agrumi pugliesi infusi nell'olio appena franto.",
    descrizioneBreve:
      "Extravergine infuso a freddo con scorze di limone, per dare luce a pesce, insalate e dolci.",
    storytelling:
      "Lavoriamo le scorze di limone insieme alle olive in fase di frangitura, così che l'aroma resti legato all'olio in modo naturale, senza aromi aggiunti in un secondo momento.",
    origine: "Puglia",
    metodo: "Frangitura a freddo con scorze di limone",
    idealePer: ["Per regalare", "Per scoprire", "Per condire a crudo"],
    gusto: ["Agrumato", "Fresco", "Aromatico"],
    formati: [{ id: "limone-250", formato: "250 ml", prezzo: 10.9, disponibile: true }],
    abbinamenti: ["Pesce crudo", "Insalate di mare", "Dolci al limone"],
    ricetteCorrelate: ["tartare-branzino-agrumi"],
    prodottiCorrelati: ["aromatizzato-peperoncino", "kit-degustazione"],
    accent: "gold",
  },
  {
    slug: "aromatizzato-peperoncino",
    nome: "Aromatizzato al Peperoncino",
    categoria: "aromatizzati",
    referenza: "Aromatizzati",
    tagline: "Il piccante pugliese, in una bottiglia.",
    descrizioneBreve:
      "Extravergine infuso con peperoncino pugliese, per dare carattere a paste, bruschette e grigliate.",
    storytelling:
      "Il peperoncino utilizzato viene essiccato e lavorato secondo una ricetta di famiglia, per un piccante che accompagna il fruttato dell'olio invece di coprirlo.",
    origine: "Puglia",
    metodo: "Frangitura a freddo con peperoncino",
    idealePer: ["Per cucinare", "Per regalare", "Per scoprire"],
    gusto: ["Piccante", "Deciso", "Speziato"],
    formati: [{ id: "peperoncino-250", formato: "250 ml", prezzo: 10.9, disponibile: true }],
    abbinamenti: ["Spaghetti aglio olio e peperoncino", "Bruschette", "Pizza"],
    ricetteCorrelate: ["spaghetti-aglio-olio-peperoncino"],
    prodottiCorrelati: ["aromatizzato-limone", "aromatizzato-aglio"],
    accent: "clay",
  },
  {
    slug: "aromatizzato-basilico",
    nome: "Aromatizzato al Basilico",
    categoria: "aromatizzati",
    referenza: "Aromatizzati",
    tagline: "Il profumo dell'orto pugliese in cucina.",
    descrizioneBreve:
      "Extravergine infuso con basilico fresco, perfetto per condire pomodori, mozzarella e primi piatti estivi.",
    storytelling:
      "Il basilico viene lavorato in piccoli lotti nei mesi estivi, quando l'aroma è più intenso, per un olio che porta in tavola il profumo dell'orto tutto l'anno.",
    origine: "Puglia",
    metodo: "Frangitura a freddo con basilico fresco",
    idealePer: ["Per condire a crudo", "Per regalare"],
    gusto: ["Erbaceo", "Fresco", "Aromatico"],
    formati: [{ id: "basilico-250", formato: "250 ml", prezzo: 10.9, disponibile: true }],
    abbinamenti: ["Caprese", "Pasta al pomodoro", "Bruschette estive"],
    ricetteCorrelate: ["burrata-pomodori-confit"],
    prodottiCorrelati: ["aromatizzato-limone", "kit-degustazione"],
    accent: "olive",
  },
  {
    slug: "aromatizzato-aglio",
    nome: "Aromatizzato all'Aglio",
    categoria: "aromatizzati",
    referenza: "Aromatizzati",
    tagline: "La base di ogni soffritto pugliese, già pronta.",
    descrizioneBreve:
      "Extravergine infuso con aglio, per accorciare i tempi in cucina senza rinunciare al sapore.",
    storytelling:
      "Un olio pensato per chi cucina spesso: l'aglio è lavorato insieme alle olive per dare un aroma pulito, senza la nota pungente dell'aglio crudo tritato al momento.",
    origine: "Puglia",
    metodo: "Frangitura a freddo con aglio",
    idealePer: ["Per cucinare", "Per ogni giorno"],
    gusto: ["Sapido", "Intenso", "Pratico in cucina"],
    formati: [{ id: "aglio-250", formato: "250 ml", prezzo: 10.9, disponibile: true }],
    abbinamenti: ["Soffritti", "Verdure saltate", "Bruschette"],
    ricetteCorrelate: ["spaghetti-aglio-olio-peperoncino"],
    prodottiCorrelati: ["aromatizzato-peperoncino", "squeeze-me"],
    accent: "forest",
  },
  {
    slug: "squeeze-me",
    nome: "Squeeze Me",
    categoria: "squeezable",
    referenza: "Squeeze Me",
    tagline: "L'olio Pantaleo, pensato per l'uso quotidiano in cucina.",
    descrizioneBreve:
      "Flacone squeezable pratico e senza gocciolamenti, per dosare l'olio con precisione ogni giorno.",
    storytelling:
      "Squeeze Me nasce dall'osservazione di come l'olio viene davvero usato ogni giorno: in padella, sull'insalata, al volo. Lo stesso extravergine delle nostre bottiglie, in un formato pensato per la vita in cucina.",
    origine: "Puglia",
    metodo: "Estrazione a freddo",
    idealePer: ["Per ogni giorno", "Per cucinare"],
    gusto: ["Equilibrato", "Versatile"],
    formati: [{ id: "squeeze-250", formato: "250 ml", prezzo: 8.9, disponibile: true }],
    abbinamenti: ["Uso quotidiano in padella", "Condimento veloce a tavola"],
    ricetteCorrelate: [],
    prodottiCorrelati: ["100-italiano", "zero"],
    accent: "clay",
  },
  {
    slug: "kit-degustazione",
    nome: "Kit Degustazione Pantaleo",
    categoria: "kit-degustazione",
    referenza: "Kit Degustazione",
    badge: "Idea regalo",
    tagline: "Quattro oli, un solo viaggio nel gusto pugliese.",
    descrizioneBreve:
      "Un cofanetto con quattro formati da 100 ml per scoprire la gamma Pantaleo, dal più delicato al più intenso.",
    storytelling:
      "Il Kit Degustazione è il modo più semplice per orientarsi nella nostra gamma: quattro referenze in formato da scoperta, pensate per essere assaggiate una accanto all'altra, a confronto.",
    origine: "Puglia",
    idealePer: ["Per regalare", "Per scoprire"],
    gusto: ["Percorso guidato", "Dal delicato all'intenso"],
    formati: [{ id: "kit-4x100", formato: "4 x 100 ml", prezzo: 29.9, disponibile: true }],
    abbinamenti: ["Degustazione guidata a tavola", "Confronto tra profili sensoriali"],
    ricetteCorrelate: [],
    prodottiCorrelati: ["selezione-oro", "igp-puglia", "rusticano", "zero"],
    accent: "gold",
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(categoria: OilCategory): Product[] {
  return products.filter((p) => p.categoria === categoria);
}

export function getRelatedProducts(product: Product): Product[] {
  return product.prodottiCorrelati
    .map((slug) => getProductBySlug(slug))
    .filter((p): p is Product => Boolean(p));
}

export function minPrice(product: Product): number {
  return Math.min(...product.formati.map((f) => f.prezzo));
}

export function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}
