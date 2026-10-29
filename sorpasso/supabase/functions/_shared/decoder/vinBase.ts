/**
 * Decodifica di base dal numero di telaio (VIN), senza servizi esterni:
 * controlla il formato e riconosce il costruttore dalle prime 3 cifre (WMI).
 * Non ricava modello né motore: per quello serve un provider esterno.
 */
import type { VehicleDecoder } from "./tipi.ts";

const WMI: Record<string, string> = {
  ZFA: "Fiat", ZFF: "Ferrari", ZAR: "Alfa Romeo", ZLA: "Lancia", ZAM: "Maserati", ZHW: "Lamborghini", ZFC: "Fiat",
  WVW: "Volkswagen", WVG: "Volkswagen", WV1: "Volkswagen", WV2: "Volkswagen", "3VW": "Volkswagen",
  WAU: "Audi", WUA: "Audi", WBA: "BMW", WBS: "BMW", WBY: "BMW", WMW: "Mini", WDD: "Mercedes-Benz", WDB: "Mercedes-Benz",
  W1K: "Mercedes-Benz", W1N: "Mercedes-Benz", WME: "Smart", WP0: "Porsche", WP1: "Porsche", W0L: "Opel", W0V: "Opel",
  WF0: "Ford", VF1: "Renault", VF3: "Peugeot", VF7: "Citroën", VR3: "Peugeot", VR7: "Citroën", VR1: "DS",
  UU1: "Dacia", VSS: "Seat", VSK: "Nissan", TMB: "Škoda", TMA: "Hyundai", TMK: "Hyundai", KMH: "Hyundai",
  KNA: "Kia", KNE: "Kia", U5Y: "Kia", JTD: "Toyota", JTE: "Toyota", JTN: "Toyota", SB1: "Toyota", VNK: "Toyota",
  JN1: "Nissan", SJN: "Nissan", JHM: "Honda", SHH: "Honda", JMZ: "Mazda", JMB: "Mitsubishi", JSA: "Suzuki",
  TSM: "Suzuki", YV1: "Volvo", LVY: "Volvo", SAL: "Land Rover", SAJ: "Jaguar", "1C4": "Jeep", "1J4": "Jeep",
  "1J8": "Jeep", ZAC: "Jeep", LSJ: "MG", SAR: "MG", LRW: "Tesla", "5YJ": "Tesla", XW8: "Volkswagen",
  VSE: "Suzuki", LGX: "BYD", YS3: "Saab", VXK: "Opel", VXE: "Opel", ZCF: "Iveco", NMT: "Toyota",
};

/** Formato VIN: 17 caratteri, niente I, O, Q. */
export const telaioValido = (vin: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);

export const vinBase: VehicleDecoder = {
  id: "vin_base",
  nome: "Decodifica di base del telaio (gratuita)",
  descrizione: "Controlla il numero di telaio e riconosce la marca. Modello e motore vanno inseriti a mano.",
  supportaTarga: false,
  supportaTelaio: true,
  configurato: () => true,
  async decodifica({ telaio }) {
    if (!telaio) return null;
    const vin = telaio.toUpperCase().replace(/\s/g, "");
    if (!telaioValido(vin)) return null;
    const marca = WMI[vin.slice(0, 3)];
    return marca ? { marca, telaio: vin } : { telaio: vin };
  },
};
