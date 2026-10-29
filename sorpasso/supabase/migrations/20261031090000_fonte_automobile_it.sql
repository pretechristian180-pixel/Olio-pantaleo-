-- Nuova fonte lead per Automobile.it (in un file separato: un valore enum nuovo
-- non si può usare nella stessa transazione in cui viene aggiunto).
alter type public.fonte_lead add value if not exists 'automobile_it' after 'subito';
