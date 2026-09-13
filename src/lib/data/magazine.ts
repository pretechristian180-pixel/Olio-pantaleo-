export type ArticleCategory =
  | "Storia"
  | "Puglia"
  | "Olio"
  | "Cucina"
  | "Benessere"
  | "Territorio"
  | "Innovazione";

export interface Article {
  slug: string;
  titolo: string;
  categoria: ArticleCategory;
  estratto: string;
  corpo: string[];
  tempoLettura: string;
}

export const articles: Article[] = [
  {
    slug: "quattro-generazioni-pantaleo",
    titolo: "Quattro generazioni, un solo frantoio",
    categoria: "Storia",
    tempoLettura: "5 min",
    estratto: "Come una famiglia di Fasano ha attraversato oltre 130 anni senza mai smettere di lavorare la stessa terra.",
    corpo: [
      "Non capita spesso di poter raccontare oltre un secolo di storia attraverso una sola attività di famiglia. Da Fasano, in provincia di Brindisi, la famiglia Pantaleo lavora l'olivo dal 1890, passando il testimone di generazione in generazione senza mai interrompere il filo che lega la terra al frantoio.",
      "Ogni generazione ha lasciato un segno diverso: chi ha ampliato gli uliveti, chi ha introdotto i primi impianti di estrazione a freddo, chi ha aperto l'azienda ai mercati fuori regione. La quarta generazione, oggi alla guida, ha il compito più delicato: innovare senza disperdere quello che le generazioni precedenti hanno costruito.",
      "È una storia fatta più di continuità che di svolte improvvise. E forse è proprio questo il segreto: un'azienda che cambia lentamente, restando fedele al proprio mestiere.",
    ],
  },
  {
    slug: "olio-nuovo-perche-conta",
    titolo: "Cos'è davvero l'olio nuovo, e perché conta",
    categoria: "Olio",
    tempoLettura: "4 min",
    estratto: "Ogni ottobre si parla di 'olio novello'. Ma cosa succede davvero in frantoio in quei giorni?",
    corpo: [
      "Con l'inizio della raccolta, le olive vengono portate in frantoio ancora verdi, o appena invaiate. La molitura entro poche ore dalla raccolta è ciò che distingue un vero olio nuovo da un olio qualsiasi: più tempo passa tra raccolta e frangitura, più il frutto perde le caratteristiche che rendono unico l'olio di quell'annata.",
      "Il risultato è un olio più piccante, più amaro, con un fruttato verde molto marcato: caratteristiche che si addolciscono naturalmente nei mesi successivi, mano a mano che l'olio matura in cisterna.",
      "Per questo motivo lavoriamo l'olio nuovo in edizione limitata, per un periodo molto breve dell'anno: è un prodotto che racconta un momento preciso della stagione, non un formato standard della gamma.",
    ],
  },
  {
    slug: "cultivar-pugliesi",
    titolo: "Coratina, Ogliarola, Cima di Bitonto: le cultivar della Puglia",
    categoria: "Territorio",
    tempoLettura: "6 min",
    estratto: "Non tutte le olive sono uguali. Un piccolo viaggio tra le varietà che lavoriamo ogni anno.",
    corpo: [
      "La Puglia ospita decine di varietà di olivo, ognuna con caratteristiche diverse di resa, resistenza e profilo sensoriale. Nel nostro lavoro utilizziamo principalmente Coratina, Ogliarola e Cima di Bitonto, spesso in blend, a volte in purezza.",
      "La Coratina è la cultivar del carattere: dà oli intensi, amari e piccanti, con un'ottima capacità di conservazione nel tempo. L'Ogliarola è più delicata ed elegante, con un fruttato medio molto equilibrato. La Cima di Bitonto porta invece note più erbacee.",
      "Conoscere queste differenze è il primo passo per capire perché due bottiglie di olio extravergine, entrambe pugliesi, possano avere un gusto completamente diverso.",
    ],
  },
  {
    slug: "come-leggere-etichetta-olio",
    titolo: "Come leggere davvero un'etichetta di olio extravergine",
    categoria: "Olio",
    tempoLettura: "5 min",
    estratto: "Origine, acidità, data di raccolta: cosa guardare prima di scegliere una bottiglia.",
    corpo: [
      "'Extravergine' non basta a garantire la qualità di un olio. Il primo elemento da controllare è l'origine delle olive: un'etichetta che riporta un paese preciso, o un'indicazione geografica come l'IGP Puglia, garantisce una tracciabilità che un generico 'miscela di oli di origine UE' non offre.",
      "Anche la data di raccolta o l'annata sono informazioni utili: l'olio, a differenza del vino, va consumato preferibilmente entro 12-18 mesi dalla frangitura, in un luogo fresco e al riparo dalla luce.",
      "Infine, il metodo di estrazione: 'a freddo' significa che le olive non sono state riscaldate durante la lavorazione, preservando aromi e componenti nutrizionali che il calore tenderebbe a disperdere.",
    ],
  },
  {
    slug: "olio-evo-cucina-quotidiana",
    titolo: "Un olio diverso per ogni momento della cucina",
    categoria: "Cucina",
    tempoLettura: "4 min",
    estratto: "Perché usare lo stesso olio per soffriggere e per condire a crudo è quasi sempre uno spreco.",
    corpo: [
      "Un errore comune in cucina è utilizzare la stessa bottiglia di olio per ogni preparazione. In realtà, un olio delicato e versatile è perfetto per cotture quotidiane, mentre un olio più intenso e fruttato dà il meglio di sé a crudo, dove i suoi aromi non vengono alterati dal calore.",
      "Tenere in cucina due referenze diverse, una per cucinare e una per condire, è probabilmente il modo più semplice per alzare il livello dei propri piatti senza cambiare una sola ricetta.",
      "È lo stesso principio che ci ha guidato nel costruire la nostra gamma: non un solo olio per tutto, ma referenze pensate per usi specifici.",
    ],
  },
  {
    slug: "polifenoli-benessere-olio",
    titolo: "Polifenoli: perché l'amaro e il piccante sono un buon segno",
    categoria: "Benessere",
    tempoLettura: "5 min",
    estratto: "Il pizzicore in gola che si sente assaggiando un olio giovane non è un difetto: è ricchezza.",
    corpo: [
      "Chi assaggia per la prima volta un olio extravergine molto fruttato spesso resta sorpreso dall'amaro e dal piccante che si percepiscono in gola. Sono sensazioni legate ai polifenoli, sostanze naturalmente presenti nell'oliva che si trasferiscono nell'olio durante l'estrazione a freddo.",
      "Un olio raffinato o lavorato con metodi meno rispettosi del frutto perde gran parte di queste componenti, risultando più neutro al palato, ma anche più povero.",
      "Per questo, in un olio extravergine di qualità, l'amaro e il piccante non sono un difetto da correggere: sono il segno di una lavorazione attenta e di una materia prima sana.",
    ],
  },
  {
    slug: "fasano-valle-itria",
    titolo: "Fasano e la Valle d'Itria, terra di ulivi secolari",
    categoria: "Puglia",
    tempoLettura: "4 min",
    estratto: "Il paesaggio che ha reso possibile la storia di Pantaleo.",
    corpo: [
      "Tra Fasano, Cisternino e Locorotondo, la Valle d'Itria custodisce alcuni degli uliveti più antichi della Puglia, con alberi che in alcuni casi hanno centinaia di anni. È un paesaggio fatto di muretti a secco, trulli e terra rossa, dove l'olivo non è mai stato solo una coltura, ma un elemento del paesaggio stesso.",
      "Lavorare in questo territorio significa confrontarsi ogni anno con un clima mediterraneo caldo e ventilato, ideale per la coltivazione dell'olivo, ma anche con le sfide sempre più frequenti legate ai cambiamenti climatici.",
      "È la ragione per cui, accanto al lavoro in frantoio, la famiglia Pantaleo ha sempre considerato la cura degli uliveti una responsabilità di lungo periodo, non un'attività stagionale.",
    ],
  },
  {
    slug: "biologico-scelta-conversione",
    titolo: "Perché convertire un uliveto al biologico richiede anni, non stagioni",
    categoria: "Innovazione",
    tempoLettura: "5 min",
    estratto: "Il percorso che ha portato una parte dei nostri uliveti alla certificazione biologica.",
    corpo: [
      "La conversione di un uliveto all'agricoltura biologica non è una decisione che produce effetti immediati: richiede un periodo di transizione di alcuni anni, durante il quale il terreno deve riequilibrarsi naturalmente, senza l'uso di prodotti di sintesi.",
      "Per la nostra famiglia è stata una scelta maturata nel tempo, in continuità con un modo di lavorare la terra che, in molti aspetti, richiama pratiche già utilizzate dalle generazioni precedenti, prima che l'agricoltura intensiva diventasse la norma.",
      "Oggi la linea Biologico e Bio Young nascono da questo percorso: un modo diverso di intendere la produttività, in cui il tempo della terra viene rispettato invece che forzato.",
    ],
  },
  {
    slug: "olio-in-tavola-abbinamenti",
    titolo: "Costruire un piccolo 'olio bar' in tavola",
    categoria: "Cucina",
    tempoLettura: "4 min",
    estratto: "Un'idea semplice per chi ama sperimentare i sapori a tavola, anche con gli ospiti.",
    corpo: [
      "Un'idea che proponiamo spesso a chi ci scrive per farsi consigliare un olio: portare in tavola due o tre referenze diverse invece di una sola, lasciando che ogni persona scelga in base al piatto e al proprio gusto.",
      "Un fruttato leggero per chi preferisce un olio discreto, un olio più intenso per chi ama il carattere deciso, un aromatizzato per dare una nota diversa a un piatto altrimenti semplice.",
      "È un piccolo gesto che trasforma il momento del pasto in un'esperienza di scoperta, ed è esattamente lo spirito con cui abbiamo pensato il nostro Kit Degustazione.",
    ],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
