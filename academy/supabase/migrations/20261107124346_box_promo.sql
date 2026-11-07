-- Riquadro promozionale nell'area studenti (es. "Prenota la consulenza"), deciso da ogni academy.
alter table public.tenants
  add column promo jsonb not null default '{}'::jsonb
    check (jsonb_typeof(promo) = 'object' and pg_column_size(promo) < 3000);

grant select (promo) on public.tenants to anon, authenticated;
grant update (promo) on public.tenants to authenticated;

-- Nexora: il Check Digitale com'era (il link si imposta dal pannello).
update public.tenants
set promo = jsonb_build_object(
  'attivo', true,
  'sopratitolo', 'Check digitale',
  'testo', 'Vuoi applicare il corso alla tua azienda? Prenota il Check Digitale Nexora.',
  'pulsante', 'Prenota gratis',
  'link', ''
)
where slug = 'nexora';
