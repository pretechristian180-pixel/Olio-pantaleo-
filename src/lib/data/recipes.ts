export interface Recipe {
  slug: string;
  titolo: string;
  categoria: "Primi" | "Secondi" | "Antipasti" | "Contorni";
  tempo: string;
  difficolta: "Facile" | "Media" | "Impegnativa";
  porzioni: number;
  ingredienti: string[];
  procedimento: string[];
  oliConsigliati: string[];
  descrizione: string;
}

export const recipes: Recipe[] = [
  {
    slug: "tartare-branzino-agrumi",
    titolo: "Tartare di branzino agli agrumi",
    categoria: "Antipasti",
    tempo: "20 min",
    difficolta: "Facile",
    porzioni: 4,
    ingredienti: [
      "400 g di filetto di branzino freschissimo",
      "1 arancia",
      "1 limone",
      "Sale, pepe",
      "Olio Pantaleo Selezione Oro o Aromatizzato al Limone",
    ],
    procedimento: [
      "Tagliare il branzino a cubetti piccoli e regolari.",
      "Condire con la scorza grattugiata di arancia e limone, sale e pepe.",
      "Emulsionare con l'olio a filo, mescolando delicatamente.",
      "Lasciare riposare 10 minuti in frigorifero prima di servire.",
    ],
    oliConsigliati: ["selezione-oro", "aromatizzato-limone"],
    descrizione:
      "Un piatto dove l'olio è protagonista quanto il pesce: la scelta tra un fruttato elegante o un aromatizzato agli agrumi cambia completamente il risultato.",
  },
  {
    slug: "burrata-pomodori-confit",
    titolo: "Burrata e pomodori confit al basilico",
    categoria: "Antipasti",
    tempo: "45 min",
    difficolta: "Facile",
    porzioni: 4,
    ingredienti: [
      "2 burrate pugliesi",
      "500 g di pomodorini datterini",
      "Basilico fresco",
      "Zucchero, sale",
      "Olio Pantaleo Selezione Oro o Aromatizzato al Basilico",
    ],
    procedimento: [
      "Tagliare i pomodorini a metà e disporli su una teglia con sale, zucchero e olio.",
      "Cuocere in forno a 140°C per circa 35 minuti.",
      "Lasciare intiepidire e disporre attorno alla burrata.",
      "Completare con basilico fresco e un filo di olio a crudo.",
    ],
    oliConsigliati: ["selezione-oro", "aromatizzato-basilico"],
    descrizione: "Il classico incontro tra latticino e pomodoro, elevato dalla cottura lenta dei confit.",
  },
  {
    slug: "fave-cicorie",
    titolo: "Fave e cicorie",
    categoria: "Primi",
    tempo: "1 h 15 min",
    difficolta: "Media",
    porzioni: 4,
    ingredienti: [
      "400 g di fave secche decorticate",
      "500 g di cicoria di campo",
      "1 cipolla",
      "Sale",
      "Olio Pantaleo IGP Puglia",
    ],
    procedimento: [
      "Cuocere le fave secche con la cipolla fino a ottenere una purea liscia.",
      "Lessare la cicoria in acqua salata e scolarla.",
      "Servire la purea di fave calda con la cicoria a fianco.",
      "Completare entrambe con un filo abbondante di olio a crudo.",
    ],
    oliConsigliati: ["igp-puglia", "rusticano"],
    descrizione:
      "Il piatto simbolo della cucina povera pugliese, dove la qualità dell'olio a crudo fa tutta la differenza.",
  },
  {
    slug: "orecchiette-cime-rapa",
    titolo: "Orecchiette alle cime di rapa",
    categoria: "Primi",
    tempo: "35 min",
    difficolta: "Media",
    porzioni: 4,
    ingredienti: [
      "400 g di orecchiette fresche",
      "600 g di cime di rapa",
      "2 spicchi d'aglio",
      "Peperoncino q.b.",
      "Olio Pantaleo Aromatizzato all'Aglio o IGP Puglia",
    ],
    procedimento: [
      "Pulire le cime di rapa e lessarle nella stessa acqua della pasta.",
      "Scaldare l'olio con aglio e peperoncino in una padella larga.",
      "Scolare pasta e cime di rapa insieme e saltarle in padella.",
      "Servire con un filo di olio a crudo.",
    ],
    oliConsigliati: ["aromatizzato-aglio", "igp-puglia"],
    descrizione: "Un primo piatto identitario della tradizione pugliese, essenziale negli ingredienti.",
  },
  {
    slug: "fettunta-oronovo",
    titolo: "Fettunta con OroNovo",
    categoria: "Antipasti",
    tempo: "10 min",
    difficolta: "Facile",
    porzioni: 4,
    ingredienti: ["4 fette di pane casereccio", "1 spicchio d'aglio", "Sale", "Olio Pantaleo OroNovo"],
    procedimento: [
      "Abbrustolire il pane su una griglia o in forno.",
      "Strofinare la superficie con l'aglio.",
      "Salare leggermente.",
      "Versare abbondante OroNovo appena franto e servire subito.",
    ],
    oliConsigliati: ["oronovo"],
    descrizione:
      "Il modo più diretto per conoscere l'olio nuovo dell'annata: senza nient'altro a distrarre il palato.",
  },
  {
    slug: "fagioli-cotiche",
    titolo: "Fagioli e cotiche",
    categoria: "Secondi",
    tempo: "2 h",
    difficolta: "Media",
    porzioni: 4,
    ingredienti: [
      "300 g di fagioli borlotti",
      "300 g di cotiche di maiale",
      "Passata di pomodoro",
      "Sedano, carota, cipolla",
      "Olio Pantaleo Rusticano",
    ],
    procedimento: [
      "Ammorbidire le cotiche in acqua bollente e tagliarle a listarelle.",
      "Preparare un soffritto con olio, sedano, carota e cipolla.",
      "Aggiungere cotiche, pomodoro e fagioli, coprire con acqua e cuocere lentamente per circa 90 minuti.",
      "Regolare di sale e servire ben caldo.",
    ],
    oliConsigliati: ["rusticano"],
    descrizione: "Un piatto sostanzioso della tradizione contadina, che regge bene un olio dal carattere deciso.",
  },
  {
    slug: "pesce-forno-agrumi",
    titolo: "Pesce al forno con agrumi ed erbe",
    categoria: "Secondi",
    tempo: "40 min",
    difficolta: "Facile",
    porzioni: 4,
    ingredienti: [
      "1 orata o spigola intera (circa 1 kg)",
      "1 limone",
      "Rosmarino e timo freschi",
      "Sale",
      "Olio Pantaleo Biologico",
    ],
    procedimento: [
      "Pulire il pesce e riempirlo con fette di limone ed erbe aromatiche.",
      "Disporlo su una teglia, condire con olio e sale.",
      "Cuocere in forno a 190°C per circa 25 minuti.",
      "Servire con un filo di olio a crudo.",
    ],
    oliConsigliati: ["biologico"],
    descrizione: "Una ricetta semplice dove la qualità dell'olio biologico resta protagonista.",
  },
  {
    slug: "carpaccio-verdure-crude",
    titolo: "Carpaccio di verdure crude di stagione",
    categoria: "Antipasti",
    tempo: "20 min",
    difficolta: "Facile",
    porzioni: 4,
    ingredienti: [
      "2 finocchi",
      "2 carote",
      "1 zucchina",
      "Scaglie di parmigiano",
      "Olio Pantaleo Bio Young",
    ],
    procedimento: [
      "Affettare finemente le verdure con una mandolina.",
      "Disporle su un piatto da portata sovrapponendole leggermente.",
      "Aggiungere scaglie di parmigiano e sale.",
      "Condire con abbondante olio Bio Young a crudo.",
    ],
    oliConsigliati: ["bio-young"],
    descrizione: "Un piatto fresco che valorizza il fruttato verde e aromatico dell'olio biologico giovane.",
  },
  {
    slug: "spaghetti-aglio-olio-peperoncino",
    titolo: "Spaghetti aglio, olio e peperoncino",
    categoria: "Primi",
    tempo: "15 min",
    difficolta: "Facile",
    porzioni: 4,
    ingredienti: [
      "350 g di spaghetti",
      "3 spicchi d'aglio",
      "Peperoncino q.b.",
      "Prezzemolo",
      "Olio Pantaleo Aromatizzato al Peperoncino",
    ],
    procedimento: [
      "Cuocere gli spaghetti in acqua salata.",
      "Scaldare l'olio con aglio in camicia a fuoco dolce.",
      "Scolare la pasta al dente e saltarla in padella con l'olio.",
      "Completare con prezzemolo tritato e un filo di olio a crudo.",
    ],
    oliConsigliati: ["aromatizzato-peperoncino", "aromatizzato-aglio"],
    descrizione: "Il piatto più semplice della cucina italiana, dove la qualità dell'olio si sente in ogni forchettata.",
  },
  {
    slug: "vellutata-verdure",
    titolo: "Vellutata di verdure per tutta la famiglia",
    categoria: "Primi",
    tempo: "30 min",
    difficolta: "Facile",
    porzioni: 4,
    ingredienti: [
      "1 zucca piccola",
      "2 carote",
      "1 patata",
      "Brodo vegetale",
      "Olio Pantaleo Zero",
    ],
    procedimento: [
      "Tagliare le verdure a cubetti e cuocerle nel brodo per circa 20 minuti.",
      "Frullare fino a ottenere una crema liscia.",
      "Regolare di sale.",
      "Servire con un filo di olio Zero, delicato anche per i più piccoli.",
    ],
    oliConsigliati: ["zero"],
    descrizione: "Una ricetta pensata per la tavola di ogni giorno, dove serve un olio gentile ma vero.",
  },
];

export function getRecipeBySlug(slug: string): Recipe | undefined {
  return recipes.find((r) => r.slug === slug);
}
