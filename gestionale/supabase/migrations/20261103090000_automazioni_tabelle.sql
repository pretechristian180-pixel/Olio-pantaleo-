-- =====================================================================
-- AUTOMAZIONI (1/3): tabelle, regole di accesso, impostazioni dei canali
-- "Quando succede X, aspetta Y, fai Z", con ricette pronte e già attive.
-- Le chiavi di WhatsApp ed email sono solo secrets delle Edge Functions.
-- =====================================================================

-- I contatti importati non fanno partire le automazioni di benvenuto (Importazione guidata)
alter table public.contacts add column if not exists importato boolean not null default false;

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  descrizione text,
  attiva boolean not null default true,
  ricetta_codice text,
  trigger_tipo text not null check (trigger_tipo in (
    'creazione', 'cambio_fase', 'data_evento', 'data_campo', 'nessuna_risposta', 'inattivita', 'periodico', 'data_fissa')),
  trigger_entita text not null check (trigger_entita in ('contact', 'property', 'deal', 'acquisition', 'appointment', 'match')),
  trigger_condizioni jsonb not null default '{}',
  attesa_valore integer not null default 0 check (attesa_valore >= 0),
  attesa_unita text not null default 'minuti' check (attesa_unita in ('minuti', 'ore', 'ore_lavorative', 'giorni', 'giorni_lavorativi')),
  attesa_direzione text not null default 'dopo' check (attesa_direzione in ('dopo', 'prima')),
  azione_tipo text not null check (azione_tipo in ('whatsapp', 'email', 'task', 'evento_agenda', 'notifica_interna', 'cambio_temperatura')),
  azione_destinatario text not null default 'contatto' check (azione_destinatario in ('contatto', 'proprietario', 'agente_assegnato', 'titolare')),
  -- {template: codice del modello} per i messaggi; {titolo: "..."} per task e notifiche; {task_aggiuntivo: "..."}; {temperatura: "freddo"}
  azione_contenuto jsonb not null default '{}',
  -- Messaggi promozionali (auguri, festività): solo a chi ha dato il consenso
  richiede_consenso boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (agency_id, ricetta_codice)
);
create index on public.automations (agency_id, trigger_entita) where attiva;

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  automation_id uuid not null,
  entita_tipo text not null,
  entita_id uuid not null,
  contact_id uuid,
  -- Evita doppioni: una esecuzione per automazione, entità e "occasione" (data, fase, periodo)
  chiave text not null default '',
  esegui_alle timestamptz not null,
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'eseguita', 'annullata', 'fallita', 'saltata')),
  motivo text,
  canale text,
  testo text,
  tentativi integer not null default 0,
  bloccato_fino timestamptz,
  eseguita_at timestamptz,
  created_at timestamptz not null default now(),
  unique (automation_id, entita_id, chiave),
  foreign key (automation_id, agency_id) references public.automations (id, agency_id) on delete cascade,
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete set null (contact_id)
);
create index on public.automation_runs (stato, esegui_alle) where stato = 'in_attesa';
create index on public.automation_runs (agency_id, created_at desc);
create index on public.automation_runs (contact_id, agency_id);
create index on public.automation_runs (contact_id, eseguita_at) where stato = 'eseguita';

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  codice text not null,
  nome text not null,
  canale text not null check (canale in ('whatsapp', 'email')),
  oggetto text,
  testo text not null check (length(trim(testo)) > 0),
  whatsapp_template_name text,
  whatsapp_template_stato text not null default 'bozza' check (whatsapp_template_stato in ('bozza', 'in_revisione', 'approvato', 'rifiutato')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, codice)
);

create table public.opt_outs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null default public.get_my_agency_id() references public.agencies (id) on delete cascade,
  contact_id uuid not null,
  canale text not null check (canale in ('whatsapp', 'email', 'tutti')),
  motivo text,
  created_at timestamptz not null default now(),
  unique (contact_id, canale),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id) on delete cascade
);
create index on public.opt_outs (agency_id);

-- Impostazioni dei canali per agenzia (nessun segreto: i token sono secrets delle Edge Functions)
create table public.messaging_settings (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  whatsapp_phone_number_id text,
  email_risposta text,
  link_recensioni text check (link_recensioni is null or link_recensioni ~ '^https://'),
  updated_at timestamptz not null default now()
);

create trigger automations_updated_at before update on public.automations for each row execute function public.set_updated_at();
create trigger message_templates_updated_at before update on public.message_templates for each row execute function public.set_updated_at();
create trigger messaging_settings_updated_at before update on public.messaging_settings for each row execute function public.set_updated_at();

-- Se cambia il testo di un modello già approvato da Meta, va riapprovato
create or replace function public.message_template_testo_cambiato()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.testo is distinct from old.testo and new.whatsapp_template_stato in ('approvato', 'in_revisione')
     and new.whatsapp_template_stato is not distinct from old.whatsapp_template_stato then
    new.whatsapp_template_stato := 'bozza';
  end if;
  return new;
end $$;
create trigger message_templates_testo before update on public.message_templates
  for each row execute function public.message_template_testo_cambiato();

-- ---------- RLS ----------
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.message_templates enable row level security;
alter table public.opt_outs enable row level security;
alter table public.messaging_settings enable row level security;

create policy "automazioni: lettura agenzia" on public.automations
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "automazioni: inserimento titolare" on public.automations
  for insert to authenticated with check (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()) and ricetta_codice is null);
create policy "automazioni: modifica titolare" on public.automations
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
create policy "automazioni: eliminazione titolare" on public.automations
  for delete to authenticated using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()) and ricetta_codice is null);

-- Cronologia: il titolare vede tutto, l'agente le esecuzioni dei contatti che vede
create policy "esecuzioni: lettura" on public.automation_runs
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (
    (select public.is_titolare()) or (contact_id is not null and exists (select 1 from public.contacts c where c.id = contact_id))));

create policy "modelli: lettura agenzia" on public.message_templates
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "modelli: inserimento titolare" on public.message_templates
  for insert to authenticated with check (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
create policy "modelli: modifica titolare" on public.message_templates
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));

create policy "esclusi: lettura" on public.opt_outs
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or exists (select 1 from public.contacts c where c.id = contact_id)));
create policy "esclusi: inserimento" on public.opt_outs
  for insert to authenticated
  with check (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or public.can_edit_contact(contact_id)));
create policy "esclusi: eliminazione" on public.opt_outs
  for delete to authenticated
  using (agency_id = (select public.get_my_agency_id()) and ((select public.is_titolare()) or public.can_edit_contact(contact_id)));

create policy "canali: lettura agenzia" on public.messaging_settings
  for select to authenticated using (agency_id = (select public.get_my_agency_id()));
create policy "canali: inserimento titolare" on public.messaging_settings
  for insert to authenticated with check (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()));
create policy "canali: modifica titolare" on public.messaging_settings
  for update to authenticated
  using (agency_id = (select public.get_my_agency_id()) and (select public.is_titolare()))
  with check (agency_id = (select public.get_my_agency_id()));

-- Dei modelli e delle automazioni il titolare cambia solo testi, tempi e interruttore; struttura delle ricette fissa
revoke update on public.automations from authenticated;
grant update (nome, descrizione, attiva, trigger_condizioni, attesa_valore, attesa_unita, attesa_direzione,
              azione_tipo, azione_destinatario, azione_contenuto, richiede_consenso) on public.automations to authenticated;
revoke update on public.message_templates from authenticated;
grant update (nome, oggetto, testo, whatsapp_template_name) on public.message_templates to authenticated;

revoke execute on function public.message_template_testo_cambiato() from public, anon, authenticated;
