/**
 * Versione "anteprima" di src/services/acquisitions.ts: stesse funzioni, dati di esempio in memoria.
 */
import { emitChange } from "@/services/events";
import type { Contact, ID, Property } from "@/types/domain";
import type { AcqPhase, Acquisition, AcquisitionPatch, LossReason } from "@/types/acquisitions";
import { demoDb } from "./api";

const wait = <T,>(value: T, ms = 300) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE");

function base(over: Partial<Acquisition> & Pick<Acquisition, "id" | "address" | "phase">): Acquisition {
  return {
    agentId: "u_1",
    contactId: null,
    city: "Bari",
    zone: "",
    kind: "appartamento",
    sqm: null,
    askingPrice: null,
    valuedPrice: null,
    source: "passaparola",
    phaseSince: daysAgo(3),
    lossReason: null,
    temperature: "tiepido",
    nextAction: "",
    nextActionDate: null,
    propertyId: null,
    notes: "",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    canEdit: true,
    ...over,
  };
}

const owner = (id: string, firstName: string, lastName: string, phone: string) => ({ id, firstName, lastName, phone });

const items: Acquisition[] = [
  base({ id: "aq1", address: "Via Calefati 45", phase: "segnalazione", source: "cartello", phaseSince: daysAgo(2), createdAt: daysAgo(2),
    contactId: "aqc1", owner: owner("aqc1", "Anna", "De Santis", "340 118 2233"), nextAction: "Chiamare per presentarsi", nextActionDate: day(0) }),
  base({ id: "aq2", address: "Corso Cavour 120", phase: "primo_contatto", zone: "Murat", sqm: 110, askingPrice: 320000, temperature: "caldo", phaseSince: daysAgo(18),
    contactId: "aqc2", owner: owner("aqc2", "Franco", "Lattanzio", "347 902 1188"), nextAction: "Fissare la valutazione", nextActionDate: day(-2), createdAt: daysAgo(25) }),
  base({ id: "aq3", address: "Via Amendola 8", phase: "valutazione_fissata", zone: "Poggiofranco", sqm: 85, askingPrice: 210000, phaseSince: daysAgo(4),
    contactId: "aqc3", owner: owner("aqc3", "Rosa", "Mininni", "328 445 7766"), nextAction: "Valutazione in casa alle 17", nextActionDate: day(1), source: "portale" }),
  base({ id: "aq4", address: "Lungomare Nazario Sauro 30", phase: "valutazione_fatta", zone: "Lungomare", kind: "appartamento", sqm: 140, askingPrice: 520000, valuedPrice: 470000,
    temperature: "caldo", phaseSince: daysAgo(6), contactId: "aqc4", owner: owner("aqc4", "Vito", "Carofiglio", "333 671 0045"), nextAction: "Portare la proposta di incarico", nextActionDate: day(0), source: "telefonata" }),
  base({ id: "aq5", address: "Via Pitagora 3, Triggiano", city: "Triggiano", phase: "proposta_incarico", kind: "villa", sqm: 180, askingPrice: 390000, valuedPrice: 360000,
    phaseSince: daysAgo(16), contactId: "aqc5", owner: owner("aqc5", "Lucia", "Gentile", "339 220 9981"), source: "porta_a_porta" }),
  base({ id: "aq6", address: "Via Dante 77", phase: "incarico_firmato", sqm: 95, valuedPrice: 245000, phaseSince: daysAgo(5), createdAt: daysAgo(30),
    contactId: "c7", owner: owner("c7", "Nicola", "Ricci", "348 553 2290"), propertyId: "p1" }),
  base({ id: "aq7", address: "Via Napoli 200", phase: "persa", lossReason: "altra_agenzia", phaseSince: daysAgo(9), createdAt: daysAgo(20), source: "social" }),
  base({ id: "aq8", address: "Via Fanelli 11", phase: "persa", lossReason: "prezzo", phaseSince: daysAgo(12), createdAt: daysAgo(14) }),
];

const copy = () => items.map((a) => ({ ...a, owner: a.owner ? { ...a.owner } : undefined }));

export async function listAcquisitions() {
  return wait(copy());
}

export async function getAcquisition(id: ID) {
  return wait(copy().find((a) => a.id === id) ?? null);
}

export async function quickAddAcquisition(input: { address: string; ownerName: string; phone: string }) {
  if (!input.address.trim()) throw Object.assign(new Error("Scrivi l'indirizzo dell'immobile"), { code: "23514" });
  const id = demoDb.newId("aq");
  let o: Acquisition["owner"];
  if (input.ownerName.trim()) {
    const [first, ...rest] = input.ownerName.trim().split(/\s+/);
    o = owner(demoDb.newId("c"), first, rest.join(" "), input.phone.trim());
    demoDb.addContact({ id: o.id, agencyId: "ag_1", agentId: "u_1", firstName: o.firstName, lastName: o.lastName, phone: o.phone ?? "", role: "proprietario",
      temperature: "tiepido", source: null, createdAt: new Date().toISOString() } as Contact);
  }
  items.unshift(base({ id, address: input.address.trim(), phase: "segnalazione", city: "", phaseSince: new Date().toISOString(), createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), contactId: o?.id ?? null, owner: o, source: null }));
  emitChange();
  return wait(id);
}

export async function updateAcquisition(id: ID, p: AcquisitionPatch) {
  const a = items.find((x) => x.id === id);
  if (a) Object.assign(a, p, { updatedAt: new Date().toISOString() });
  emitChange();
  return wait(undefined);
}

export async function addOwner(id: ID, name: string, phone: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const o = owner(demoDb.newId("c"), first, rest.join(" "), phone.trim());
  const a = items.find((x) => x.id === id);
  if (a) Object.assign(a, { contactId: o.id, owner: o });
  emitChange();
  return wait(undefined);
}

export async function setAcquisitionPhase(id: ID, phase: AcqPhase, reason?: LossReason): Promise<ID | null> {
  const a = items.find((x) => x.id === id)!;
  if (phase === "persa" && !reason) throw Object.assign(new Error("Scegli il motivo per cui è persa"), { code: "23514" });
  if (phase === "incarico_firmato") {
    const price = a.valuedPrice ?? a.askingPrice;
    if (!a.contactId) throw Object.assign(new Error("Aggiungi il proprietario prima di segnare l'incarico firmato"), { code: "23514" });
    if (!a.city) throw Object.assign(new Error("Scrivi la città dell'immobile"), { code: "23514" });
    if (price == null) throw Object.assign(new Error("Scrivi il prezzo dell'incarico"), { code: "23514" });
    const pid = demoDb.newId("p");
    const kind = a.kind ?? "appartamento";
    demoDb.addProperty({
      id: pid, agencyId: "ag_1", agentId: a.agentId, kind, title: `${kind[0].toUpperCase()}${kind.slice(1)}${a.sqm ? ` di ${a.sqm} mq` : ""} in ${a.address}`,
      address: a.address, city: a.city, zone: a.zone || a.city, contract: "vendita", status: "disponibile", price, sqm: a.sqm, rooms: null, bathrooms: null,
      description: a.notes, photos: [{ id: `${pid}_f0`, scene: "esterno" }], ownerId: a.contactId, mandateStart: day(0), mandateEnd: day(180), tint: 25,
      createdAt: new Date().toISOString(),
    } as Property);
    Object.assign(a, { phase, propertyId: pid, phaseSince: new Date().toISOString(), lossReason: null, nextAction: "", nextActionDate: null });
    emitChange();
    return wait(pid);
  }
  Object.assign(a, { phase, lossReason: phase === "persa" ? reason : null, phaseSince: new Date().toISOString(), updatedAt: new Date().toISOString() });
  emitChange();
  return wait(null);
}

export async function deleteAcquisition(id: ID) {
  const i = items.findIndex((x) => x.id === id);
  if (i >= 0) items.splice(i, 1);
  emitChange();
}

export async function acquisitionsToFollow() {
  const today = day(0);
  return wait(
    copy()
      .filter((a) => !["incarico_firmato", "persa"].includes(a.phase) && a.nextActionDate && a.nextActionDate <= today)
      .sort((a, b) => a.nextActionDate!.localeCompare(b.nextActionDate!)),
  );
}
