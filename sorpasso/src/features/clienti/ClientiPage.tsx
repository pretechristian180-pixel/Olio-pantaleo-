import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Phone, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState, ListSkeleton } from "@/components/shared/States";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NuovoLeadDialog from "@/features/leads/NuovoLeadDialog";
import { useSessione } from "@/lib/auth";
import { nomeCompleto } from "@/lib/format";
import { linkTelefono, linkWhatsApp } from "@/lib/messaggi";
import { useColleghi } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { type ContattoElenco, leadAperti, useContatti } from "./api";

type Filtro = "tutti" | "aperti" | "acquirenti" | "marketing";

const FILTRI: { value: Filtro; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "aperti", label: "Con lead aperti" },
  { value: "acquirenti", label: "Hanno acquistato" },
  { value: "marketing", label: "Consenso marketing" },
];

const normalizza = (s: string) => s.toLowerCase().replace(/\s+/g, "");

export default function ClientiPage() {
  const { isAmministrazione } = useSessione();
  const contatti = useContatti();
  const colleghi = useColleghi();
  const navigate = useNavigate();
  const [cerca, setCerca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [nuovoLead, setNuovoLead] = useState(false);

  const nomiColleghi = useMemo(() => new Map(colleghi.data?.map((p) => [p.user_id, p.nome])), [colleghi.data]);

  const filtrati = useMemo(() => {
    const t = normalizza(cerca);
    return (contatti.data ?? []).filter((c) => {
      if (filtro === "aperti" && leadAperti(c) === 0) return false;
      if (filtro === "acquirenti" && c.deals.length === 0) return false;
      if (filtro === "marketing" && !c.consenso_marketing) return false;
      if (!t) return true;
      return [nomeCompleto(c), c.telefono, c.email, c.comune, ...c.tag].some((v) => v && normalizza(v).includes(t));
    });
  }, [contatti.data, cerca, filtro]);

  const azione = !isAmministrazione && (
    <Button variant="accent" onClick={() => setNuovoLead(true)}>
      <Plus aria-hidden /> Nuovo lead
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Clienti"
        subtitle={contatti.data ? `${contatti.data.length} contatti in archivio` : "Tutti i contatti della concessionaria"}
        action={azione}
      />

      {contatti.isLoading ? (
        <ListSkeleton rows={6} />
      ) : contatti.isError ? (
        <ErrorState error={contatti.error} onRetry={() => void contatti.refetch()} />
      ) : !contatti.data?.length ? (
        <EmptyState
          art="persone"
          title="Ancora nessun cliente"
          text="I clienti nascono dai lead: inserisci il primo contatto arrivato in salone, al telefono o dai portali."
          action={azione}
        />
      ) : (
        <>
          <div className="mb-5 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={cerca}
                onChange={(e) => setCerca(e.target.value)}
                placeholder="Cerca per nome, telefono, email o comune"
                className="pl-11"
                aria-label="Cerca clienti"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none" role="group" aria-label="Filtra clienti">
              {FILTRI.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filtro === f.value}
                  onClick={() => setFiltro(f.value)}
                  className={cn(
                    "h-10 shrink-0 rounded-full border px-4 text-[15px] font-medium transition-colors",
                    filtro === f.value ? "border-primary bg-primary text-white" : "bg-background hover:bg-muted",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filtrati.length === 0 ? (
            <EmptyState
              art="ricerca"
              title="Nessun cliente trovato"
              text="Prova a cambiare la ricerca o il filtro."
              action={
                <Button variant="outline" onClick={() => (setCerca(""), setFiltro("tutti"))}>
                  Mostra tutti
                </Button>
              }
            />
          ) : (
            <>
              {/* Telefono: card */}
              <ul className="space-y-3 md:hidden">
                {filtrati.map((c) => (
                  <li key={c.id} className="rounded-lg border bg-card p-4 shadow-card">
                    <Link to={`/clienti/${c.id}`} className="flex items-start gap-3">
                      <Avatar nome={nomeCompleto(c)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[17px] font-semibold">{nomeCompleto(c)}</p>
                        <p className="truncate text-[15px] text-muted-foreground">
                          {[c.telefono, c.comune].filter(Boolean).join(" · ") || c.email}
                        </p>
                        <Indicatori c={c} venditore={c.venditore_assegnato ? nomiColleghi.get(c.venditore_assegnato) : undefined} />
                      </div>
                    </Link>
                    {c.telefono && <AzioniRapide telefono={c.telefono} nome={c.nome} className="mt-3" />}
                  </li>
                ))}
              </ul>

              {/* Desktop: tabella */}
              <div className="hidden overflow-hidden rounded-lg border bg-card shadow-card md:block">
                <table className="w-full text-left text-[15px]">
                  <thead className="border-b bg-muted/60 text-sm text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Contatti</th>
                      <th className="px-4 py-3 font-medium">Venditore</th>
                      <th className="px-4 py-3 font-medium">Situazione</th>
                      <th className="px-4 py-3 font-medium">
                        <span className="sr-only">Azioni</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtrati.map((c) => (
                      <tr key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clienti/${c.id}`)}>
                        <td className="px-4 py-3">
                          <Link to={`/clienti/${c.id}`} className="flex items-center gap-3 font-semibold" onClick={(e) => e.stopPropagation()}>
                            <Avatar nome={nomeCompleto(c)} size="sm" />
                            <span>
                              {nomeCompleto(c)}
                              {c.comune && <span className="block text-sm font-normal text-muted-foreground">{c.comune}</span>}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">{c.telefono ?? "—"}</span>
                          {c.email && <span className="block max-w-56 truncate text-sm text-muted-foreground">{c.email}</span>}
                        </td>
                        <td className="px-4 py-3">{(c.venditore_assegnato && nomiColleghi.get(c.venditore_assegnato)) || "—"}</td>
                        <td className="px-4 py-3">
                          <Indicatori c={c} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {c.telefono && <AzioniRapide telefono={c.telefono} nome={c.nome} compatte />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {nuovoLead && <NuovoLeadDialog open={nuovoLead} onOpenChange={setNuovoLead} />}
    </>
  );
}

function Indicatori({ c, venditore }: { c: ContattoElenco; venditore?: string }) {
  const aperti = leadAperti(c);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {aperti > 0 && (
        <Badge tone="accent" size="sm">
          {aperti === 1 ? "1 lead aperto" : `${aperti} lead aperti`}
        </Badge>
      )}
      {c.deals.length > 0 && (
        <Badge tone="green" size="sm">
          {c.deals.length === 1 ? "1 acquisto" : `${c.deals.length} acquisti`}
        </Badge>
      )}
      {aperti === 0 && c.deals.length === 0 && (
        <Badge tone="gray" size="sm">
          Nessun lead aperto
        </Badge>
      )}
      {c.tag.map((t) => (
        <Badge key={t} tone="blue" size="sm" dot={false}>
          {t}
        </Badge>
      ))}
      {venditore && <span className="text-sm text-muted-foreground">· {venditore}</span>}
    </div>
  );
}

function AzioniRapide({ telefono, nome, compatte, className }: { telefono: string; nome: string; compatte?: boolean; className?: string }) {
  return (
    <div className={cn("flex gap-2", !compatte && "[&>*]:flex-1", className)}>
      <Button asChild variant="outline" size={compatte ? "icon-sm" : "sm"}>
        <a href={linkTelefono(telefono)} aria-label={`Chiama ${nome}`}>
          <Phone aria-hidden />
          {!compatte && "Chiama"}
        </a>
      </Button>
      <Button asChild variant="outline" size={compatte ? "icon-sm" : "sm"}>
        <a href={linkWhatsApp(telefono)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${nome}`}>
          <MessageCircle aria-hidden />
          {!compatte && "WhatsApp"}
        </a>
      </Button>
    </div>
  );
}
