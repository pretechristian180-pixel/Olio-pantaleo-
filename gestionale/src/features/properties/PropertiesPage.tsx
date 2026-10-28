import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useQuery } from "@/hooks/useQuery";
import { listProperties, listZones, type PropertyFilters } from "@/services/api";
import type { Contract, PropertyStatus } from "@/types/domain";
import { PropertyCard, PropertyCardSkeleton } from "./PropertyCard";

export function PropertiesPage() {
  const [query, setQuery] = useState("");
  const [contract, setContract] = useState<Contract | "tutti">("tutti");
  const [status, setStatus] = useState<PropertyStatus | "tutti">("tutti");
  const [zone, setZone] = useState("tutte");
  const filters: PropertyFilters = { query, contract, status, zone };
  const { data, loading } = useQuery(() => listProperties(filters), [query, contract, status, zone]);
  const zones = listZones();
  const filtering = query !== "" || contract !== "tutti" || status !== "tutti" || zone !== "tutte";

  function reset() {
    setQuery("");
    setContract("tutti");
    setStatus("tutti");
    setZone("tutte");
  }

  const addButton = (
    <Button size="lg" asChild>
      <Link to="/immobili/nuovo">
        <Plus aria-hidden />
        Aggiungi immobile
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Immobili"
        subtitle={data ? `${data.length} ${data.length === 1 ? "immobile" : "immobili"}${filtering ? " trovati" : ""}` : " "}
        action={addButton}
      />

      <div className="mb-6 space-y-3 lg:flex lg:items-center lg:gap-3 lg:space-y-0">
        <div className="relative lg:flex-1">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per via o città"
            aria-label="Cerca immobili"
            className="pl-11"
          />
        </div>
        <Segmented
          label="Tipo di contratto"
          value={contract}
          onChange={setContract}
          className="lg:w-72"
          options={[
            { value: "tutti", label: "Tutti" },
            { value: "vendita", label: "Vendita" },
            { value: "affitto", label: "Affitto" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PropertyStatus | "tutti")} aria-label="Stato" className="lg:w-44">
            <option value="tutti">Ogni stato</option>
            <option value="disponibile">Disponibile</option>
            <option value="trattativa">In trattativa</option>
            <option value="venduto">Venduto</option>
          </Select>
          <Select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zona" className="lg:w-48">
            <option value="tutte">Ogni zona</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </div>
      ) : data.length === 0 ? (
        filtering ? (
          <EmptyState
            art="ricerca"
            title="Nessun immobile trovato"
            text="Prova a togliere qualche filtro."
            action={
              <Button variant="outline" onClick={reset}>
                Togli i filtri
              </Button>
            }
          />
        ) : (
          <EmptyState art="casa" title="Nessun immobile ancora" text="Aggiungi il primo: bastano due minuti." action={addButton} />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
