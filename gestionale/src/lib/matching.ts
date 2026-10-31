import { formatPrice, whatsappLink } from "@/lib/format";
import type { Contact, Property, SearchCriteria } from "@/types/domain";

/**
 * Messaggio WhatsApp già scritto per proporre un immobile a un cliente.
 * L'agente lo vede in WhatsApp prima di inviarlo e può cambiarlo.
 */
export function proposalText(contact: Contact, p: Property, agentFirstName: string, agencyName: string) {
  const dettagli = [
    formatPrice(p.price, p.contract === "affitto"),
    p.sqm != null ? `${p.sqm} mq` : null,
    p.rooms != null ? `${p.rooms} ${p.rooms === 1 ? "locale" : "locali"}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    `Buongiorno ${contact.firstName}, sono ${agentFirstName} di ${agencyName}. ` +
    `Ho un immobile che corrisponde a quello che cerca: ${p.title.charAt(0).toLowerCase() + p.title.slice(1)} in ${p.address}, ${p.city} (${dettagli}). ` +
    `Le va di vederlo? Posso mandarle subito foto e planimetria.`
  );
}

export function proposalLink(contact: Contact, p: Property, agentFirstName: string, agencyName: string) {
  return `${whatsappLink(contact.phone)}?text=${encodeURIComponent(proposalText(contact, p, agentFirstName, agencyName))}`;
}

/**
 * Stessa logica della funzione SQL `match_eval` (migrazione "matching").
 * Nell'app vera il punteggio lo calcola il database: questa copia serve solo all'anteprima con dati di esempio.
 */
export function evaluateMatch(p: Property, s: SearchCriteria): { score: number; reasons: string[] } | null {
  let score = 45;
  const reasons: string[] = [];
  if (s.active === false) return null;
  if (s.contract && s.contract !== p.contract) return null;
  if (s.budgetMax != null && p.price > s.budgetMax * 1.1) return null;
  if (s.sqmMin != null && p.sqm != null && p.sqm < s.sqmMin * 0.9) return null;
  const zones = s.zones.map((z) => z.trim().toLowerCase()).filter(Boolean);
  if (zones.length) {
    if (!zones.includes(p.zone.trim().toLowerCase()) && !zones.includes(p.city.trim().toLowerCase())) return null;
    score += 15;
    reasons.push("Zona giusta");
  }
  if (s.budgetMax != null) {
    if (p.price <= s.budgetMax) {
      score += 20;
      reasons.push("Nel budget");
    } else {
      score += 5;
      reasons.push(`${Math.ceil((p.price / s.budgetMax - 1) * 100)}% sopra il budget`);
    }
  }
  if (s.budgetMin != null && p.price < s.budgetMin * 0.8) {
    score -= 10;
    reasons.push("Sotto il budget minimo");
  }
  if (s.sqmMin != null && p.sqm != null) {
    if (p.sqm >= s.sqmMin) {
      score += 10;
      reasons.push(`${p.sqm} mq`);
    } else reasons.push(`${p.sqm} mq, poco meno dei ${s.sqmMin} chiesti`);
  }
  if (s.roomsMin != null && p.rooms != null) {
    const diff = p.rooms - s.roomsMin;
    if (diff >= 0) {
      score += 10;
      reasons.push(diff === 0 ? "Locali giusti" : diff === 1 ? "1 locale in più" : `${diff} locali in più`);
    } else {
      score -= 10;
      reasons.push(diff === -1 ? "1 locale in meno" : `${-diff} locali in meno`);
    }
  }
  if (s.kind) {
    if (s.kind === p.kind) {
      score += 10;
      reasons.push("Tipo giusto");
    } else {
      score -= 15;
      reasons.push("Tipo diverso");
    }
  }
  const wanted = (s.features ?? []).map((f) => f.trim().toLowerCase()).filter(Boolean);
  if (wanted.length) {
    const has = (p.features ?? []).map((f) => f.trim().toLowerCase());
    const present = wanted.filter((f) => has.includes(f));
    const missing = wanted.filter((f) => !has.includes(f));
    if (present.length) {
      score += Math.min(12, 4 * present.length);
      reasons.push(`Ha ${present.join(", ")}`);
    }
    if (missing.length) {
      score -= Math.min(12, 3 * missing.length);
      reasons.push(`Senza ${missing.join(", ")}`);
    }
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}
