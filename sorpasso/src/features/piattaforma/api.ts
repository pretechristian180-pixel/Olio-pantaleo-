/** Dati e azioni del pannello della piattaforma (solo amministratori Sorpasso). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ErroreLeggibile, ok } from "@/lib/errors";
import type { Organization, Ruolo } from "@/types/db";

export type StatoOrg = "prova" | "attiva" | "sospesa" | "disdetta";
export type Piano = "start" | "pro" | "dealer_ai";

export interface NumeriUso {
  utenti_attivi: number;
  auto_in_stock: number;
  lead_30gg: number;
  vendite_30gg: number;
  ultimo_accesso: string | null;
}

export interface OrgRiga extends NumeriUso {
  id: string;
  nome: string;
  piva: string | null;
  comune: string | null;
  stato: StatoOrg;
  piano: Piano;
  prova_fino_al: string | null;
  max_utenti: number | null;
  referente_nome: string | null;
  referente_email: string | null;
  created_at: string;
  titolare_nome: string | null;
  titolare_email: string | null;
}

export interface OrgScheda extends Organization, NumeriUso {
  stato: StatoOrg;
  piano: Piano;
  prova_fino_al: string | null;
  max_utenti: number | null;
  referente_nome: string | null;
  referente_email: string | null;
  referente_telefono: string | null;
  note_piattaforma: string | null;
  motivo_sospensione: string | null;
  sospesa_at: string | null;
}

export interface UtenteOrg {
  user_id: string;
  nome: string;
  email: string;
  ruolo: Ruolo;
  telefono: string | null;
  attivo: boolean;
  created_at: string;
  ultimo_accesso: string | null;
  email_confermata: boolean;
  invitato_at: string | null;
}

export interface VoceRegistro {
  id: string;
  azione: string;
  dettagli: Record<string, unknown>;
  created_at: string;
  admin_nome: string | null;
}

const qkP = {
  tutte: ["piattaforma"] as const,
  elenco: ["piattaforma", "elenco"] as const,
  org: (id: string) => ["piattaforma", "org", id] as const,
};

export function useOrganizzazioni() {
  return useQuery({
    queryKey: qkP.elenco,
    queryFn: async () => ok(await supabase.rpc("piattaforma_organizzazioni")) as OrgRiga[],
  });
}

export function useOrganizzazione(id: string | undefined) {
  return useQuery({
    queryKey: [...qkP.org(id ?? ""), "scheda"],
    enabled: !!id,
    queryFn: async () => ok(await supabase.rpc("piattaforma_organizzazione", { p_org: id })) as OrgScheda,
  });
}

export function useUtentiOrg(id: string | undefined) {
  return useQuery({
    queryKey: [...qkP.org(id ?? ""), "utenti"],
    enabled: !!id,
    queryFn: async () => ok(await supabase.rpc("piattaforma_utenti", { p_org: id })) as UtenteOrg[],
  });
}

export function useRegistro(id: string | undefined) {
  return useQuery({
    queryKey: [...qkP.org(id ?? ""), "registro"],
    enabled: !!id,
    queryFn: async () => ok(await supabase.rpc("piattaforma_registro", { p_org: id })) as VoceRegistro[],
  });
}

function useInvalida() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qkP.tutte });
}

export function useAggiornaOrganizzazione() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async ({ id, dati }: { id: string; dati: Record<string, unknown> }) =>
      ok(await supabase.rpc("piattaforma_aggiorna_organizzazione", { p_org: id, p_dati: dati })),
    onSuccess: () => invalida(),
  });
}

export function useAggiornaUtente() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: async (v: { userId: string; ruolo?: Ruolo; attivo?: boolean }) =>
      ok(await supabase.rpc("piattaforma_aggiorna_utente", { p_user: v.userId, p_ruolo: v.ruolo ?? null, p_attivo: v.attivo ?? null })),
    onSuccess: () => invalida(),
  });
}

/** Chiama la Edge Function "piattaforma" e restituisce il messaggio d'errore del server in italiano. */
async function piattaforma<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("piattaforma", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const b = await error.context.json().catch(() => null);
      throw new ErroreLeggibile(b?.error ?? "Operazione non riuscita. Riprova.");
    }
    throw new ErroreLeggibile("Servizio non raggiungibile. Controlla la connessione.");
  }
  return data as T;
}

export type ModoAccesso = "invito" | "password";

export interface NuovaConcessionaria {
  azienda: { nome: string; piva: string; indirizzo: string; comune: string; telefono: string; email: string };
  piano: Piano;
  stato: "prova" | "attiva";
  prova_giorni: number;
  max_utenti: number | null;
  titolare: { nome: string; email: string; telefono: string };
  accesso: ModoAccesso;
}

export function useCreaConcessionaria() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: (v: NuovaConcessionaria) =>
      piattaforma<{ organization_id: string; user_id: string; password: string | null }>({ azione: "crea_concessionaria", ...v }),
    onSuccess: () => invalida(),
  });
}

export function useAggiungiUtente() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: (v: { organization_id: string; nome: string; email: string; telefono: string; ruolo: Ruolo; accesso: ModoAccesso }) =>
      piattaforma<{ user_id: string; password: string | null }>({ azione: "aggiungi_utente", ...v }),
    onSuccess: () => invalida(),
  });
}

export function useAzioneAccount() {
  const invalida = useInvalida();
  return useMutation({
    mutationFn: (v: { azione: "reinvia_invito" | "link_accesso" | "nuova_password"; user_id: string }) =>
      piattaforma<{ ok?: boolean; link?: string; password?: string }>(v),
    onSuccess: () => invalida(),
  });
}

export const STATI_ORG: Record<StatoOrg, { label: string; tone: "green" | "accent" | "red" | "gray" }> = {
  attiva: { label: "Attiva", tone: "green" },
  prova: { label: "In prova", tone: "accent" },
  sospesa: { label: "Sospesa", tone: "red" },
  disdetta: { label: "Disdetta", tone: "gray" },
};

export const PIANI: Record<Piano, string> = { start: "Start", pro: "Pro", dealer_ai: "Dealer AI" };

export const AZIONI_REGISTRO: Record<string, string> = {
  creazione_concessionaria: "Concessionaria creata",
  modifica_concessionaria: "Dati modificati",
  sospensione: "Concessionaria sospesa",
  riattivazione: "Concessionaria riattivata",
  aggiunta_utente: "Utente aggiunto",
  modifica_utente: "Utente modificato",
  reinvio_invito: "Invito reinviato",
  link_accesso: "Link di accesso generato",
  nuova_password: "Nuova password impostata",
};

/** Giorni rimanenti di prova (negativi se scaduta). */
export function giorniProva(fino: string | null): number | null {
  if (!fino) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${fino}T00:00:00`).getTime() - oggi.getTime()) / 86_400_000);
}
