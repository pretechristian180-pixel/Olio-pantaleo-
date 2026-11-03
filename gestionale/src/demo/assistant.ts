/** Versione "anteprima" dell'assistente: risposte di esempio sui dati dimostrativi, senza AI. */
import type { ChatMessage } from "@/services/assistant";
import { demoDb } from "./api";

export type { ChatMessage };
const wait = <T,>(v: T, ms = 1100) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export async function askAssistant(history: ChatMessage[]) {
  const q = (history[history.length - 1]?.text ?? "").toLowerCase();
  const c = demoDb.contacts();
  const p = demoDb.properties();
  const link = (x: { id: string; firstName: string; lastName: string }) => `[${x.firstName} ${x.lastName}](/contatti/${x.id})`;
  let answer: string;
  if (/richiam|oggi|fare/.test(q)) {
    answer = `Oggi hai 3 persone da richiamare, in quest'ordine:\n- ${link(c[0])}: ha visto l'appartamento ieri, è **caldo**\n- ${link(c[1])}: aspetta una risposta sulla proposta\n- [Francesca Lorusso](/contatti/lead/lead_0): lead da Immobiliare.it di 25 minuti fa, punteggio **95**\n\nAlle 9:30 hai anche la visita con ${link(c[3] ?? c[0])}.`;
  } else if (/fermi|visite|poche/.test(q)) {
    answer = `Gli immobili più fermi nell'ultimo mese:\n- [${p[2]?.address ?? "Via Calefati 45"}](/immobili/${p[2]?.id ?? ""}): nessuna visita da 24 giorni, 2 acquirenti compatibili\n- [${p[4]?.address ?? "Lungomare"}](/immobili/${p[4]?.id ?? ""}): 1 visita, 1 acquirente compatibile\n\nPer il primo valuterei nuove foto o un ritocco del prezzo: 2 visitatori su 3 lo trovavano alto.`;
  } else if (/scad|incaric/.test(q)) {
    answer = `Due incarichi scadono nel prossimo mese:\n- [${p[2]?.address ?? ""}](/immobili/${p[2]?.id ?? ""}) tra 3 giorni\n- [${p[7]?.address ?? ""}](/immobili/${p[7]?.id ?? ""}) tra 12 giorni\n\nVuoi che ti scriva il messaggio per proporre il rinnovo?`;
  } else if (/report/.test(q)) {
    answer = `Devi ancora mandare il report a 2 proprietari:\n- [${p[0]?.address ?? ""}](/immobili/${p[0]?.id ?? ""}): ultimo report 18 giorni fa\n- [${p[1]?.address ?? ""}](/immobili/${p[1]?.id ?? ""}): mai inviato\n\nLo prepari dalla scheda dell'immobile con "Prepara il report".`;
  } else if (/document/.test(q)) {
    answer = `Mancano documenti obbligatori su 1 immobile:\n- [${p[0]?.address ?? ""}](/immobili/${p[0]?.id ?? ""}): APE, planimetria catastale, visura\n\nIn scadenza: l'APE di ${p[0]?.address ?? ""} il 23 novembre.`;
  } else if (/lead/.test(q)) {
    answer = `I lead migliori di questa settimana:\n- [Francesca Lorusso](/contatti/lead/lead_0): **95**, vuole visitare e ha il mutuo approvato\n- [Teresa De Marco](/contatti/lead/lead_1): **75**, vuole vendere il suo trilocale: possibile incarico\n- [Sara Mininni](/contatti/lead/lead_3): **70**, già contattata`;
  } else if (/scriv|messaggio|annuncio|whatsapp/.test(q)) {
    answer = `Ecco un messaggio pronto:\n<<<\nBuongiorno ${c[0]?.firstName ?? ""}, sono Giuseppe di Immobiliare Levante. Volevo sapere come le è sembrato l'appartamento di ieri. Se le va, possiamo rivederlo con calma questa settimana. Un saluto!\n>>>`;
  } else {
    answer = "Nell'anteprima rispondo solo ad alcune domande di esempio. Prova con: chi devo richiamare oggi, quali immobili sono fermi, quali incarichi scadono, a chi devo mandare il report, i lead migliori, oppure \"scrivi un messaggio\".";
  }
  return wait({ answer, left: 57 });
}
