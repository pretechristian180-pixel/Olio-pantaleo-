-- Tipo di immobile dal testo libero ("Trilocale" è un appartamento, non un locale commerciale)
create or replace function public.imp_tipo_immobile(t text, p_default boolean)
returns text language sql immutable set search_path = '' as $$
  select case
    when lower(t) ~ 'monolocal|bilocal|trilocal|quadrilocal|pentalocal|appart|attico|mansard|loft' then 'appartamento'
    when lower(t) ~ 'villa|casa ind|villett|rustic|casale|masseri|trull' then 'villa'
    when lower(t) ~ 'negoz|locale|uffic|capann|magazz|laborat' then 'locale'
    when lower(t) ~ 'terren' then 'terreno'
    when lower(t) ~ 'box|garage|cantin|posto auto' then 'altro'
    when p_default then 'appartamento' end
$$;

create or replace function public.import_normalize(p_tipo text, p_map jsonb, p_row jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v jsonb := '{}';
  note text[] := '{}';
  avvisi text[] := '{}';
  col text; campo text; val text;
  d jsonb := '{}';
  errore text;
  chiave text;
  parti text[];
  tel text; mail text; n numeric; dt date;
begin
  for col, val in select key, value #>> '{}' from jsonb_each(p_row) loop
    campo := p_map ->> col;
    if public.imp_txt(val) is null then continue; end if;
    if campo is null or campo = '' then
      note := note || format('%s: %s', col, public.imp_txt(val));
    elsif v ? campo then
      v := v || jsonb_build_object(campo, (v ->> campo) || ' ' || public.imp_txt(val));
    else
      v := v || jsonb_build_object(campo, public.imp_txt(val));
    end if;
  end loop;
  if v ? 'note' then note := array[v ->> 'note'] || note; end if;

  if p_tipo = 'contatti' then
    if v ? 'nome_completo' and not (v ? 'nome') then
      parti := regexp_split_to_array(v ->> 'nome_completo', '\s+');
      v := v || jsonb_build_object('nome', parti[1], 'cognome', array_to_string(parti[2:], ' '));
    elsif v ? 'cognome_nome' and not (v ? 'nome') then
      parti := regexp_split_to_array(v ->> 'cognome_nome', '\s+');
      v := v || jsonb_build_object('cognome', parti[1], 'nome', array_to_string(parti[2:], ' '));
    end if;
    tel := public.imp_telefono(v ->> 'telefono');
    mail := public.imp_email(v ->> 'email');
    if v ? 'email' and mail is null then avvisi := avvisi || format('Email non valida: %s', v ->> 'email'); note := note || format('Email scritta: %s', v ->> 'email'); end if;
    if public.imp_txt(v ->> 'nome') is null and public.imp_txt(v ->> 'cognome') is null then errore := 'Manca il nome'; end if;
    if tel is null and mail is null and errore is null then avvisi := avvisi || 'Né telefono né email'; end if;
    d := jsonb_strip_nulls(jsonb_build_object(
      'nome', coalesce(public.imp_nome(v ->> 'nome'), public.imp_nome(v ->> 'cognome')),
      'cognome', case when public.imp_txt(v ->> 'nome') is null then '' else coalesce(public.imp_nome(v ->> 'cognome'), '') end,
      'telefono', tel, 'email', mail,
      'tipo', case
        when lower(v ->> 'tipo') ~ 'entramb|tutti e due' then 'entrambi'
        when lower(v ->> 'tipo') ~ 'locator|affitta casa|proprietario affitto' then 'locatore'
        when lower(v ->> 'tipo') ~ 'inquilin|affittuar|cerca in affitto' then 'inquilino'
        when lower(v ->> 'tipo') ~ 'propr|vend|venditor' then 'proprietario'
        when lower(v ->> 'tipo') ~ 'collabor|notai|geometr|tecnic|banca' then 'collaboratore'
        when lower(v ->> 'tipo') ~ 'acquir|compra|cerca|client' or v ->> 'tipo' is null then 'acquirente'
        else 'altro' end,
      'fonte', case
        when lower(v ->> 'fonte') ~ 'immobiliare|idealista|casa\.it|portal|subito' then 'portale'
        when lower(v ->> 'fonte') ~ 'sito|web|google' then 'sito'
        when lower(v ->> 'fonte') ~ 'passapar|amic|conosc|referenz' then 'passaparola'
        when lower(v ->> 'fonte') ~ 'facebook|instagram|social|tiktok' then 'social'
        when v ->> 'fonte' is not null then 'altro' end,
      'temperatura', case when lower(v ->> 'temperatura') ~ 'cald|alt|urgent' then 'caldo'
                          when lower(v ->> 'temperatura') ~ 'fredd|bass' then 'freddo' else 'tiepido' end,
      'data_nascita', public.imp_data(v ->> 'data_nascita'),
      'etichette', case when v ? 'etichette' then to_jsonb(array(select lower(btrim(x)) from regexp_split_to_table(v ->> 'etichette', '[,;/]') x where btrim(x) <> '')) end));
    chiave := coalesce('t:' || public.phone_key(tel), 'e:' || mail);

  elsif p_tipo = 'richieste' then
    d := jsonb_strip_nulls(jsonb_build_object(
      'contatto_telefono', public.imp_telefono(v ->> 'contatto_telefono'),
      'contatto_email', public.imp_email(v ->> 'contatto_email'),
      'contatto_nome', public.imp_txt(v ->> 'contatto_nome'),
      'contratto', case when lower(v ->> 'contratto') ~ 'affitt|locaz' then 'affitto' else 'vendita' end,
      'zone', case when v ? 'zone' then to_jsonb(array(select initcap(btrim(x)) from regexp_split_to_table(v ->> 'zone', '[,;/]') x where btrim(x) <> '')) end,
      'budget_min', public.imp_numero(v ->> 'budget_min'),
      'budget_max', public.imp_numero(v ->> 'budget_max'),
      'mq_min', round(public.imp_numero(v ->> 'mq_min')),
      'locali_min', round(public.imp_numero(v ->> 'locali_min')),
      'tipo', public.imp_tipo_immobile(v ->> 'tipo_immobile', false)));
    if d ->> 'contatto_telefono' is null and d ->> 'contatto_email' is null and d ->> 'contatto_nome' is null then
      errore := 'Manca il cliente (telefono, email o nome)';
    end if;
    chiave := concat_ws('|', coalesce(public.phone_key(d ->> 'contatto_telefono'), d ->> 'contatto_email', lower(d ->> 'contatto_nome')), d ->> 'budget_max', d -> 'zone');

  elsif p_tipo in ('immobili', 'acquisizioni') then
    n := public.imp_numero(coalesce(v ->> 'prezzo', v ->> 'prezzo_richiesto'));
    d := jsonb_strip_nulls(jsonb_build_object(
      'titolo', public.imp_txt(v ->> 'titolo'),
      'indirizzo', public.imp_txt(v ->> 'indirizzo'),
      'citta', public.imp_nome(v ->> 'citta'),
      'zona', public.imp_txt(v ->> 'zona'),
      'prezzo', n,
      'prezzo_valutato', public.imp_numero(v ->> 'prezzo_valutato'),
      'mq', round(public.imp_numero(v ->> 'mq')),
      'locali', round(public.imp_numero(v ->> 'locali')),
      'bagni', round(public.imp_numero(v ->> 'bagni')),
      'tipo', public.imp_tipo_immobile(v ->> 'tipo_immobile', true),
      'contratto', case when lower(v ->> 'contratto') ~ 'affitt|locaz' then 'affitto' else 'vendita' end,
      'stato', case when lower(v ->> 'stato') ~ 'vendut' then 'venduto' when lower(v ->> 'stato') ~ 'affittat' then 'affittato'
                    when lower(v ->> 'stato') ~ 'trattativ|propost' then 'in_trattativa' when lower(v ->> 'stato') ~ 'sospes' then 'sospeso'
                    when lower(v ->> 'stato') ~ 'ritirat|scadut' then 'ritirato' else 'disponibile' end,
      'fase', case when lower(v ->> 'fase') ~ 'contatt' then 'primo_contatto' when lower(v ->> 'fase') ~ 'fissat' then 'valutazione_fissata'
                   when lower(v ->> 'fase') ~ 'valut' then 'valutazione_fatta' when lower(v ->> 'fase') ~ 'propost' then 'proposta_incarico'
                   else 'segnalazione' end,
      'fonte', case when lower(v ->> 'fonte') ~ 'cartell' then 'cartello' when lower(v ->> 'fonte') ~ 'portal|immobiliare|idealista|subito' then 'portale'
                    when lower(v ->> 'fonte') ~ 'telefon' then 'telefonata' when lower(v ->> 'fonte') ~ 'porta' then 'porta_a_porta'
                    when lower(v ->> 'fonte') ~ 'social|facebook|instagram' then 'social' when lower(v ->> 'fonte') ~ 'passapar|amic' then 'passaparola'
                    when v ->> 'fonte' is not null then 'altro' end,
      'descrizione', public.imp_txt(v ->> 'descrizione'),
      'piano', public.imp_txt(v ->> 'piano'),
      'classe_energetica', upper(public.imp_txt(v ->> 'classe_energetica')),
      'data_incarico', public.imp_data(v ->> 'data_incarico'),
      'scadenza_incarico', public.imp_data(v ->> 'scadenza_incarico'),
      'proprietario_nome', public.imp_nome(v ->> 'proprietario_nome'),
      'proprietario_telefono', public.imp_telefono(v ->> 'proprietario_telefono'),
      'proprietario_email', public.imp_email(v ->> 'proprietario_email')));
    if d ->> 'indirizzo' is null then errore := 'Manca l''indirizzo'; end if;
    if p_tipo = 'immobili' and errore is null and d ->> 'citta' is null then errore := 'Manca la città'; end if;
    if p_tipo = 'immobili' and errore is null and coalesce(n, 0) <= 0 then errore := 'Manca il prezzo'; end if;
    if p_tipo = 'acquisizioni' and lower(v ->> 'fase') ~ 'firmat|persa|pers' then
      avvisi := avvisi || 'Fase finale non importabile: messa in "Segnalazione"';
    end if;
    chiave := lower(regexp_replace(coalesce(d ->> 'indirizzo', ''), '[^[:alnum:]]', '', 'g')) || '|' || lower(coalesce(d ->> 'citta', ''));

  elsif p_tipo = 'appuntamenti' then
    dt := coalesce(public.imp_data(v ->> 'data'), public.imp_data(v ->> 'data_ora'));
    d := jsonb_strip_nulls(jsonb_build_object(
      'inizio', case when dt is not null then to_char(dt + coalesce(public.imp_ora(v ->> 'ora'), public.imp_ora(substr(v ->> 'data_ora', 11)), time '09:00'), 'YYYY-MM-DD"T"HH24:MI') end,
      'durata', coalesce(round(public.imp_numero(v ->> 'durata_minuti')), 60),
      'tipo', case when lower(v ->> 'tipo') ~ 'valut|stima' then 'valutazione' when lower(v ->> 'tipo') ~ 'firm|rogit|notai|compromes|prelim' then 'firma'
                   when lower(v ->> 'tipo') ~ 'visit|sopral' or v ->> 'tipo' is null then 'visita' else 'altro' end,
      'contatto_telefono', public.imp_telefono(v ->> 'contatto_telefono'),
      'contatto_email', public.imp_email(v ->> 'contatto_email'),
      'contatto_nome', public.imp_txt(v ->> 'contatto_nome'),
      'immobile_indirizzo', public.imp_txt(v ->> 'immobile_indirizzo')));
    if dt is null then errore := 'Manca la data o non si legge'; end if;
    chiave := concat_ws('|', d ->> 'inizio', coalesce(public.phone_key(d ->> 'contatto_telefono'), d ->> 'contatto_email', lower(d ->> 'contatto_nome')));
  else
    errore := 'Tipo di importazione sconosciuto';
  end if;

  return jsonb_build_object('d', d, 'note', nullif(array_to_string(note, E'\n'), ''), 'errore', errore,
                            'chiave', nullif(chiave, ''), 'avvisi', to_jsonb(avvisi));
end $$;