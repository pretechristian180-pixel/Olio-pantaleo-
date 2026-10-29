/**
 * Catalogo optional ed equipaggiamenti, raggruppati per categoria.
 * Si salvano come testo (vehicles.optional), quindi si possono aggiungere voci
 * senza migrazioni. Nessuna dipendenza: lo usa anche scripts/seed.ts.
 */
export const CATALOGO_OPTIONAL: { categoria: string; voci: string[] }[] = [
  {
    categoria: "Sicurezza e assistenza alla guida",
    voci: [
      "ABS", "ESP", "Airbag laterali", "Airbag per le ginocchia", "Frenata automatica d'emergenza",
      "Mantenimento corsia", "Cruise control", "Cruise control adattivo", "Riconoscimento segnali stradali",
      "Monitoraggio angolo cieco", "Sensori di parcheggio anteriori", "Sensori di parcheggio posteriori",
      "Telecamera posteriore", "Telecamera a 360°", "Parcheggio automatico", "Fari LED", "Fari Matrix LED",
      "Abbaglianti automatici", "Sensore pioggia", "Sensore luci", "Isofix",
    ],
  },
  {
    categoria: "Comfort",
    voci: [
      "Climatizzatore manuale", "Climatizzatore automatico", "Climatizzatore bizona", "Sedili riscaldati",
      "Sedili ventilati", "Sedili elettrici", "Sedili con memoria", "Volante riscaldato", "Volante multifunzione",
      "Accesso e avviamento senza chiave", "Portellone elettrico", "Vetri posteriori oscurati",
      "Specchietti ripiegabili elettricamente", "Bracciolo", "Tetto panoramico", "Tetto apribile",
    ],
  },
  {
    categoria: "Multimedia e connettività",
    voci: [
      "Navigatore", "Display touchscreen", "Quadro strumenti digitale", "Head-up display", "Apple CarPlay",
      "Android Auto", "Bluetooth", "Ricarica wireless smartphone", "Porte USB", "Impianto audio premium",
      "Radio DAB", "Comandi vocali",
    ],
  },
  {
    categoria: "Esterni",
    voci: [
      "Cerchi in lega", "Vernice metallizzata", "Barre al tetto", "Gancio traino", "Pacchetto sportivo",
      "Ruotino di scorta", "Kit riparazione pneumatici",
    ],
  },
  {
    categoria: "Interni",
    voci: ["Interni in pelle", "Interni in Alcantara", "Sedili sportivi", "Luci ambiente", "Sedile posteriore frazionato"],
  },
  {
    categoria: "Tecnica",
    voci: ["Trazione integrale", "Start & Stop", "Sospensioni adattive", "Modalità di guida selezionabili", "Cavo di ricarica", "Pompa di calore"],
  },
];

export const CARROZZERIE = ["Berlina", "Hatchback", "Station wagon", "SUV", "Crossover", "Monovolume", "Coupé", "Cabrio", "Pick-up", "Furgone", "City car"];
export const CLASSI_EURO = ["Euro 6e", "Euro 6d", "Euro 6d-TEMP", "Euro 6c", "Euro 6b", "Euro 6", "Euro 5", "Euro 4", "Euro 3 o precedente"];
export const TRAZIONI = { anteriore: "Anteriore", posteriore: "Posteriore", integrale: "Integrale" } as const;
export const GARANZIE = ["Garanzia legale", "Garanzia del costruttore", "Garanzia concessionaria", "Garanzia estesa"];

/** kW → CV (1 kW = 1,35962 CV). */
export const kwInCv = (kw: number) => Math.round(kw * 1.35962);
