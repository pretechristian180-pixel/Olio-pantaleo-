import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { BackLink } from "@/components/shared/BackLink";
import { temperatureLabel, toneClasses } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { fullName } from "@/lib/format";
import { createContact, listZones } from "@/services/api";
import type { ContactRole, Contract, Temperature } from "@/types/domain";

export function NewContactPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<ContactRole>(params.get("tipo") === "proprietario" ? "proprietario" : "acquirente");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [temperature, setTemperature] = useState<Temperature>("tiepido");
  const [contract, setContract] = useState<Contract>("vendita");
  const [zone, setZone] = useState("");
  const [budget, setBudget] = useState("");
  const [sqm, setSqm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Scrivi il nome";
    if (!lastName.trim()) errs.lastName = "Scrivi il cognome";
    if (phone.replace(/\D/g, "").length < 6) errs.phone = "Controlla il numero di telefono";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const c = await createContact({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      role,
      temperature,
      search:
        role === "acquirente"
          ? { zones: zone ? [zone] : [], budgetMax: Number(budget) || 0, sqmMin: Number(sqm) || 0, contract }
          : undefined,
    });
    toast.success("Contatto salvato", { description: fullName(c) });
    navigate(`/contatti/${c.id}`, { replace: true });
  }

  const err = (k: string) => errors[k] && <p className="mt-1.5 text-sm font-medium text-destructive">{errors[k]}</p>;

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl" noValidate>
      <BackLink to="/contatti" label="Annulla" />
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Nuovo contatto</h1>

      <div className="mt-6 space-y-5">
        <Segmented
          label="Tipo di contatto"
          value={role}
          onChange={setRole}
          options={[
            { value: "acquirente", label: "Vuole comprare o affittare" },
            { value: "proprietario", label: "Vuole vendere" },
          ]}
          className="[&_button]:text-[14px] sm:[&_button]:text-[15px]"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome" htmlFor="nc-fn">
            <Input id="nc-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={cn(errors.firstName && "border-destructive")} autoComplete="off" />
            {err("firstName")}
          </Field>
          <Field label="Cognome" htmlFor="nc-ln">
            <Input id="nc-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className={cn(errors.lastName && "border-destructive")} autoComplete="off" />
            {err("lastName")}
          </Field>
        </div>
        <Field label="Telefono" htmlFor="nc-ph">
          <Input id="nc-ph" type="tel" inputMode="tel" placeholder="Es. 333 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className={cn(errors.phone && "border-destructive")} />
          {err("phone")}
        </Field>
        <Field label="Email (facoltativa)" htmlFor="nc-em">
          <Input id="nc-em" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <div>
          <p className="mb-2 text-[15px] font-medium">Quanto è interessato?</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(temperatureLabel) as Temperature[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={temperature === t}
                onClick={() => setTemperature(t)}
                className={cn(
                  "flex h-14 flex-col items-center justify-center rounded-lg border text-[15px] font-medium",
                  temperature === t ? "border-primary bg-primary-soft text-primary" : "border-input hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-full", toneClasses[temperatureLabel[t].tone].dot)} aria-hidden />
                  {temperatureLabel[t].label}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{temperatureLabel[temperature].hint}</p>
        </div>

        {role === "acquirente" && (
          <fieldset className="space-y-5 rounded-xl border p-4 sm:p-5">
            <legend className="px-1 text-lg font-semibold">Cosa cerca</legend>
            <Segmented
              label="Contratto"
              value={contract}
              onChange={setContract}
              options={[
                { value: "vendita", label: "Comprare" },
                { value: "affitto", label: "Affittare" },
              ]}
            />
            <Field label="Zona" htmlFor="nc-zone">
              <Input id="nc-zone" list="nc-zones" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Es. Polignano a Mare" />
              <datalist id="nc-zones">
                {listZones().map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={contract === "affitto" ? "Affitto max (€)" : "Budget max (€)"} htmlFor="nc-budget">
                <Input
                  id="nc-budget"
                  inputMode="numeric"
                  value={budget ? Number(budget).toLocaleString("it-IT") : ""}
                  onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Almeno mq" htmlFor="nc-sqm">
                <Input id="nc-sqm" inputMode="numeric" value={sqm} onChange={(e) => setSqm(e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
          </fieldset>
        )}
      </div>

      <Button type="submit" size="lg" className="mt-8 w-full" disabled={saving}>
        <Check aria-hidden />
        {saving ? "Salvataggio…" : "Salva contatto"}
      </Button>
    </form>
  );
}
