import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Plus } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { euroCent } from "@/lib/format";
import { numeroIt } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { CategoriaEconomica, TipoVoceEconomica } from "@/types/db";
import { useAggiornaImpostazioniEconomia, useCategorie, useSalvaCategoria, useScambiaOrdine } from "./api";
import { NOTA_COMMERCIALISTA } from "./ContoEconomicoTab";

const numeroTra = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .refine((v) => !Number.isNaN(numeroIt(v)) && numeroIt(v) >= min && numeroIt(v) <= max, msg);

const schema = z.object({
  costo_giacenza_giorno: numeroTra(0, 1000, "Inserisci un importo tra 0 e 1.000 €"),
  margine_obiettivo_pct: numeroTra(0, 90, "Inserisci una percentuale tra 0 e 90"),
});

/** Impostazioni del conto economico: giacenza, margine obiettivo, categorie. Montato in Impostazioni. */
export default function ImpostazioniEconomiaTab() {
  const { puo } = useSessione();
  if (!puo("titolare", "responsabile_vendite", "amministrazione")) {
    return <p className="text-muted-foreground">Queste impostazioni sono riservate a titolare, responsabile vendite e amministrazione.</p>;
  }
  return (
    <div className="space-y-5">
      <ParametriForm />
      <div className="grid gap-5 lg:grid-cols-2">
        <Categorie tipo="costo" titolo="Categorie di costo" />
        <Categorie tipo="ricavo" titolo="Categorie di ricavo" />
      </div>
      <p className="text-sm text-muted-foreground">{NOTA_COMMERCIALISTA}</p>
    </div>
  );
}

function ParametriForm() {
  const { organizzazione, isTitolare, ricarica } = useSessione();
  const aggiorna = useAggiornaImpostazioniEconomia();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      costo_giacenza_giorno: String(organizzazione.costo_giacenza_giorno).replace(".", ","),
      margine_obiettivo_pct: String(organizzazione.margine_obiettivo_pct).replace(".", ","),
    },
  });
  const err = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await aggiorna.mutateAsync({
        id: organizzazione.id,
        costo_giacenza_giorno: numeroIt(v.costo_giacenza_giorno),
        margine_obiettivo_pct: numeroIt(v.margine_obiettivo_pct),
      });
      await ricarica();
      toast.success("Impostazioni salvate", { description: "Margini e prezzi minimi sono stati ricalcolati." });
    } catch (e) {
      mostraErrore(e);
    }
  });

  return (
    <Section title="Parametri di calcolo">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field
          label="Costo di giacenza al giorno (€)"
          htmlFor="ie-giac"
          error={err.costo_giacenza_giorno?.message}
          hint={`Quanto costa tenere un'auto ferma un giorno (denaro immobilizzato, piazzale, assicurazione). Es. 30 giorni × ${euroCent(organizzazione.costo_giacenza_giorno)} = ${euroCent(30 * organizzazione.costo_giacenza_giorno)}.`}
        >
          <Input id="ie-giac" inputMode="decimal" disabled={!isTitolare} aria-invalid={!!err.costo_giacenza_giorno} {...form.register("costo_giacenza_giorno")} />
        </Field>
        <Field
          label="Margine obiettivo (%)"
          htmlFor="ie-marg"
          error={err.margine_obiettivo_pct?.message}
          hint="Sul ricavo netto IVA. Sopra l'obiettivo il semaforo è verde, sotto giallo, in perdita rosso."
        >
          <Input id="ie-marg" inputMode="decimal" disabled={!isTitolare} aria-invalid={!!err.margine_obiettivo_pct} {...form.register("margine_obiettivo_pct")} />
        </Field>
        {isTitolare ? (
          <div className="sm:col-span-2">
            <Button type="submit" variant="accent" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
              {form.formState.isSubmitting && <Spinner />}
              Salva parametri
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">Solo il titolare può modificare questi parametri.</p>
        )}
      </form>
    </Section>
  );
}

function Categorie({ tipo, titolo }: { tipo: TipoVoceEconomica; titolo: string }) {
  const categorie = useCategorie();
  const salva = useSalvaCategoria();
  const scambia = useScambiaOrdine();
  const [nuova, setNuova] = useState("");
  const elenco = (categorie.data ?? []).filter((c) => c.tipo === tipo);

  async function aggiungi() {
    const nome = nuova.trim();
    if (!nome) return;
    try {
      await salva.mutateAsync({ tipo, nome, ordine: Math.max(0, ...elenco.map((c) => c.ordine)) + 1 });
      setNuova("");
      toast.success("Categoria aggiunta");
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <Section title={titolo} count={elenco.length} bodyClassName="p-0 sm:p-0">
      {categorie.isError ? (
        <div className="p-4"><ErrorState error={categorie.error} onRetry={() => void categorie.refetch()} /></div>
      ) : categorie.isLoading ? (
        <ListSkeleton rows={4} className="space-y-2 p-4" />
      ) : (
        <>
          <ul className="divide-y">
            {elenco.map((c, i) => (
              <RigaCategoria
                key={c.id}
                c={c}
                onSu={i > 0 ? () => scambia.mutate([c, elenco[i - 1]!]) : undefined}
                onGiu={i < elenco.length - 1 ? () => scambia.mutate([c, elenco[i + 1]!]) : undefined}
              />
            ))}
          </ul>
          <form
            className="flex gap-2 border-t p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void aggiungi();
            }}
          >
            <Input value={nuova} onChange={(e) => setNuova(e.target.value)} placeholder="Nuova categoria" maxLength={60} aria-label={`Nuova ${titolo.toLowerCase()}`} />
            <Button type="submit" variant="outline" disabled={!nuova.trim() || salva.isPending}>
              <Plus aria-hidden /> Aggiungi
            </Button>
          </form>
        </>
      )}
    </Section>
  );
}

function RigaCategoria({ c, onSu, onGiu }: { c: CategoriaEconomica; onSu?: () => void; onGiu?: () => void }) {
  const salva = useSalvaCategoria();
  const [nome, setNome] = useState(c.nome);
  const cambiato = nome.trim() !== c.nome && nome.trim().length > 0;

  async function rinomina() {
    try {
      await salva.mutateAsync({ id: c.id, nome: nome.trim() });
      toast.success("Categoria rinominata", { description: "Le voci già registrate mantengono il nome precedente." });
    } catch (e) {
      mostraErrore(e);
      setNome(c.nome);
    }
  }

  async function attiva(v: boolean) {
    try {
      await salva.mutateAsync({ id: c.id, attiva: v });
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <li className={cn("flex flex-wrap items-center gap-2 px-4 py-2.5", !c.attiva && "bg-muted/50")}>
      <span className="flex flex-col">
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" onClick={onSu} disabled={!onSu} aria-label={`Sposta su ${c.nome}`}>
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30" onClick={onGiu} disabled={!onGiu} aria-label={`Sposta giù ${c.nome}`}>
          <ArrowDown className="size-4" aria-hidden />
        </button>
      </span>
      {c.di_sistema ? (
        <span className="flex min-w-0 flex-1 items-center gap-2" title="Usata nei calcoli: non si può rinominare né disattivare">
          <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-medium">{c.nome}</span>
          <span className="text-sm text-muted-foreground">usata nei calcoli</span>
        </span>
      ) : (
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (cambiato) void rinomina();
          }}
        >
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-10" maxLength={60} aria-label="Nome categoria" />
          {cambiato && (
            <Button type="submit" size="sm" variant="accent" disabled={salva.isPending}>
              Salva
            </Button>
          )}
        </form>
      )}
      {!c.di_sistema && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={c.attiva} onChange={(e) => void attiva(e.target.checked)} />
          Attiva
        </label>
      )}
    </li>
  );
}
