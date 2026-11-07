"use client";

import { useState } from "react";

/** Prova o omaggio; per l'omaggio, con data di fine o senza scadenza. */
export function OfferFields({
  defaultTipo = "prova",
  defaultFine,
  showProva = true,
  defaultGiorni = 14,
}: {
  defaultTipo?: "prova" | "omaggio";
  defaultFine?: string | null;
  showProva?: boolean;
  defaultGiorni?: number;
}) {
  const [tipo, setTipo] = useState(defaultTipo);
  const [scadenza, setScadenza] = useState(defaultFine ? "data" : "mai");
  const radio = "size-5 shrink-0 accent-nexora-blue";
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold">Condizioni</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="tipo"
            value="prova"
            checked={tipo === "prova"}
            onChange={() => setTipo("prova")}
            className={radio}
          />
          {showProva ? "Prova gratuita, poi abbonamento" : "A pagamento (abbonamento)"}
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="tipo"
            value="omaggio"
            checked={tipo === "omaggio"}
            onChange={() => setTipo("omaggio")}
            className={radio}
          />
          In omaggio (gratis)
        </label>
      </div>
      {tipo === "prova" && showProva && (
        <label className="flex items-center gap-3 text-sm">
          Giorni di prova
          <input
            type="number"
            name="giorni"
            min={1}
            max={365}
            defaultValue={defaultGiorni}
            required
            className="h-11 w-24 rounded-md border border-line bg-surface px-3 text-right"
          />
        </label>
      )}
      {tipo === "prova" && !showProva && (
        <input type="hidden" name="giorni" value={defaultGiorni} />
      )}
      {tipo === "omaggio" && (
        <div className="space-y-2 rounded-md bg-blue-tint p-4 text-sm">
          {showProva && <input type="hidden" name="giorni" value={defaultGiorni} />}
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="scadenza"
              value="mai"
              checked={scadenza === "mai"}
              onChange={() => setScadenza("mai")}
              className={radio}
            />
            Senza scadenza
          </label>
          <label className="flex min-h-11 flex-wrap items-center gap-2">
            <input
              type="radio"
              name="scadenza"
              value="data"
              checked={scadenza === "data"}
              onChange={() => setScadenza("data")}
              className={radio}
            />
            Fino al
            <input
              type="date"
              name="omaggio_fine"
              defaultValue={defaultFine?.slice(0, 10)}
              min={new Date().toISOString().slice(0, 10)}
              disabled={scadenza !== "data"}
              required={scadenza === "data"}
              className="h-11 rounded-md border border-line bg-surface px-3 disabled:opacity-50"
            />
          </label>
          <p className="text-xs text-ink-muted">
            Nessun pagamento richiesto. Alla scadenza l&apos;azienda vede l&apos;invito ad attivare
            l&apos;abbonamento.
          </p>
        </div>
      )}
    </fieldset>
  );
}
