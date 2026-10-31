-- Schede complete (1/2): nuovi valori dei tipi esistenti (vanno aggiunti prima di essere usati)
alter type public.tipo_contatto add value if not exists 'locatore';
alter type public.tipo_contatto add value if not exists 'inquilino';
alter type public.tipo_contatto add value if not exists 'collaboratore';
alter type public.tipo_contatto add value if not exists 'altro';
alter type public.stato_immobile add value if not exists 'sospeso' after 'in_trattativa';
