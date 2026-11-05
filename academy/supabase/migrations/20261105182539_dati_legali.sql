-- Dati legali dell'academy (chi vende ai propri studenti): pubblici, li mostrano le pagine legali.
alter table public.tenants
  add column dati_legali jsonb not null default '{}'::jsonb
    check (jsonb_typeof(dati_legali) = 'object' and pg_column_size(dati_legali) < 4000),
  -- Prova dell'accettazione delle condizioni del servizio (le scrive solo il server).
  add column termini_versione text,
  add column termini_accettati_il timestamptz;

grant select (dati_legali) on public.tenants to anon, authenticated;
grant update (dati_legali) on public.tenants to authenticated;

-- Rinuncia al recesso per l'accesso immediato ai contenuti digitali (art. 59 Codice del Consumo).
alter table public.orders add column recesso_rinuncia_il timestamptz;
