-- Nuovi prezzi dei piani (IVA esclusa). Annuale = 10 mensilità (2 mesi gratis).
update public.platform_plans set prezzo_mese_cents = 2900, prezzo_anno_cents = 29000 where codice = 'start';
update public.platform_plans set prezzo_mese_cents = 5900, prezzo_anno_cents = 59000 where codice = 'pro';
update public.platform_plans set prezzo_mese_cents = 12900, prezzo_anno_cents = 129000 where codice = 'business';
