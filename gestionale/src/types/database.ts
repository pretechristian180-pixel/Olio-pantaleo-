/**
 * Tipi del database Supabase (generati dallo schema in supabase/migrations).
 * Per rigenerarli: `npx supabase gen types typescript --project-id bwpgpsrcddlngpskyajr`
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type E = Database["public"]["Enums"];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      activities: {
        Row: {
          agency_id: string;
          contact_id: string | null;
          created_at: string;
          deal_id: string | null;
          descrizione: string;
          id: string;
          property_id: string | null;
          tipo: E["tipo_attivita"];
          utente_id: string | null;
        };
        Insert: {
          agency_id?: string;
          contact_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          descrizione: string;
          id?: string;
          property_id?: string | null;
          tipo: E["tipo_attivita"];
          utente_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: [];
      };
      agencies: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          indirizzo: string | null;
          logo_url: string | null;
          nome: string;
          piano: E["piano_agenzia"];
          telefono: string | null;
          attiva: boolean;
        };
        Insert: {
          attiva?: boolean;
          created_at?: string;
          email?: string | null;
          id?: string;
          indirizzo?: string | null;
          logo_url?: string | null;
          nome: string;
          piano?: E["piano_agenzia"];
          telefono?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["agencies"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          agency_id: string;
          agente_id: string | null;
          contact_id: string | null;
          esito: string | null;
          fine: string;
          id: string;
          inizio: string;
          note: string | null;
          property_id: string | null;
          tipo: E["tipo_appuntamento"];
        };
        Insert: {
          agency_id?: string;
          agente_id?: string | null;
          contact_id?: string | null;
          esito?: string | null;
          fine: string;
          id?: string;
          inizio: string;
          note?: string | null;
          property_id?: string | null;
          tipo?: E["tipo_appuntamento"];
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [];
      };
      contacts: {
        Row: {
          agency_id: string;
          agente_id: string | null;
          cognome: string;
          created_at: string;
          email: string | null;
          fonte: E["fonte_contatto"] | null;
          id: string;
          nome: string;
          note: string | null;
          telefono: string | null;
          temperatura: E["temperatura_contatto"];
          tipo: E["tipo_contatto"];
          updated_at: string;
          etichette: string[];
          data_nascita: string | null;
          consenso_marketing: boolean;
          consenso_marketing_at: string | null;
        };
        Insert: {
          agency_id?: string;
          agente_id?: string | null;
          cognome?: string;
          created_at?: string;
          email?: string | null;
          fonte?: E["fonte_contatto"] | null;
          id?: string;
          nome: string;
          note?: string | null;
          telefono?: string | null;
          temperatura?: E["temperatura_contatto"];
          tipo?: E["tipo_contatto"];
          updated_at?: string;
          etichette?: string[];
          data_nascita?: string | null;
          consenso_marketing?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
        Relationships: [];
      };
      deals: {
        Row: {
          agency_id: string;
          agente_id: string | null;
          contact_id: string;
          created_at: string;
          fase: E["fase_trattativa"];
          id: string;
          property_id: string | null;
          provvigione_prevista: number | null;
          updated_at: string;
          valore: number | null;
        };
        Insert: {
          agency_id?: string;
          agente_id?: string | null;
          contact_id: string;
          created_at?: string;
          fase?: E["fase_trattativa"];
          id?: string;
          property_id?: string | null;
          provvigione_prevista?: number | null;
          updated_at?: string;
          valore?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          agency_id: string;
          cognome: string | null;
          created_at: string;
          email: string;
          id: string;
          invitato_da: string | null;
          nome: string | null;
          ruolo: E["ruolo_utente"];
        };
        Insert: {
          accepted_at?: string | null;
          agency_id: string;
          cognome?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          invitato_da?: string | null;
          nome?: string | null;
          ruolo?: E["ruolo_utente"];
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          agency_id: string;
          attivo: boolean;
          avatar_url: string | null;
          cognome: string;
          created_at: string;
          id: string;
          nome: string;
          ruolo: E["ruolo_utente"];
          telefono: string | null;
        };
        Insert: {
          agency_id: string;
          attivo?: boolean;
          avatar_url?: string | null;
          cognome?: string;
          created_at?: string;
          id: string;
          nome?: string;
          ruolo?: E["ruolo_utente"];
          telefono?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      properties: {
        Row: {
          agency_id: string;
          agente_id: string | null;
          bagni: number | null;
          citta: string;
          classe_energetica: string | null;
          contratto: E["tipo_contratto"];
          created_at: string;
          data_incarico: string | null;
          descrizione: string | null;
          id: string;
          indirizzo: string;
          locali: number | null;
          mq: number | null;
          owner_id: string | null;
          piano: string | null;
          prezzo: number;
          scadenza_incarico: string | null;
          stato: E["stato_immobile"];
          tipo: E["tipo_immobile"];
          titolo: string;
          updated_at: string;
          zona: string | null;
          caratteristiche: string[];
          lat: number | null;
          lng: number | null;
        };
        Insert: {
          agency_id?: string;
          agente_id?: string | null;
          bagni?: number | null;
          citta: string;
          classe_energetica?: string | null;
          contratto?: E["tipo_contratto"];
          created_at?: string;
          data_incarico?: string | null;
          descrizione?: string | null;
          id?: string;
          indirizzo: string;
          locali?: number | null;
          mq?: number | null;
          owner_id?: string | null;
          piano?: string | null;
          prezzo: number;
          scadenza_incarico?: string | null;
          stato?: E["stato_immobile"];
          tipo?: E["tipo_immobile"];
          titolo: string;
          updated_at?: string;
          zona?: string | null;
          caratteristiche?: string[];
          lat?: number | null;
          lng?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
        Relationships: [];
      };
      property_photos: {
        Row: { agency_id: string; id: string; ordine: number; property_id: string; url: string };
        Insert: { agency_id?: string; id?: string; ordine?: number; property_id: string; url: string };
        Update: Partial<Database["public"]["Tables"]["property_photos"]["Insert"]>;
        Relationships: [];
      };
      search_criteria: {
        Row: {
          agency_id: string;
          budget_max: number | null;
          budget_min: number | null;
          contact_id: string;
          contratto: E["tipo_contratto"] | null;
          id: string;
          locali_min: number | null;
          mq_min: number | null;
          tipo: E["tipo_immobile"] | null;
          zone: string[];
          nome: string | null;
          caratteristiche: string[];
          attiva: boolean;
          note: string | null;
          created_at: string;
        };
        Insert: {
          agency_id?: string;
          budget_max?: number | null;
          budget_min?: number | null;
          contact_id: string;
          contratto?: E["tipo_contratto"] | null;
          id?: string;
          locali_min?: number | null;
          mq_min?: number | null;
          tipo?: E["tipo_immobile"] | null;
          zone?: string[];
          nome?: string | null;
          caratteristiche?: string[];
          attiva?: boolean;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["search_criteria"]["Insert"]>;
        Relationships: [];
      };
      zones: {
        Row: { agency_id: string; created_at: string; id: string; nome: string };
        Insert: { agency_id?: string; created_at?: string; id?: string; nome: string };
        Update: Partial<Database["public"]["Tables"]["zones"]["Insert"]>;
        Relationships: [];
      };
      matches: {
        Row: {
          agency_id: string;
          contact_id: string;
          created_at: string;
          id: string;
          motivi: string[];
          property_id: string;
          proposto_at: string | null;
          punteggio: number;
          stato: E["stato_match"];
          updated_at: string;
        };
        Insert: never;
        Update: { stato?: E["stato_match"] };
        Relationships: [];
      };
      tasks: {
        Row: {
          agency_id: string;
          assegnato_a: string | null;
          completato: boolean;
          contact_id: string | null;
          created_at: string;
          id: string;
          origine: E["origine_task"];
          property_id: string | null;
          scadenza: string | null;
          titolo: string;
        };
        Insert: {
          agency_id?: string;
          assegnato_a?: string | null;
          completato?: boolean;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          origine?: E["origine_task"];
          property_id?: string | null;
          scadenza?: string | null;
          titolo: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_my_invitation: { Args: never; Returns: undefined };
      is_platform_admin: { Args: never; Returns: boolean };
      admin_list_agencies: {
        Args: never;
        Returns: {
          id: string;
          nome: string;
          piano: E["piano_agenzia"];
          attiva: boolean;
          email: string | null;
          telefono: string | null;
          indirizzo: string | null;
          created_at: string;
          utenti: number;
          utenti_attivi: number;
          immobili: number;
          contatti: number;
          titolare_nome: string | null;
          titolare_email: string | null;
          ultima_attivita: string | null;
        }[];
      };
      admin_agency_users: {
        Args: { aid: string };
        Returns: {
          id: string;
          nome: string;
          cognome: string;
          email: string;
          ruolo: E["ruolo_utente"];
          attivo: boolean;
          created_at: string;
          ultimo_accesso: string | null;
          in_attesa: boolean;
        }[];
      };
      admin_update_agency: {
        Args: {
          aid: string;
          p_nome: string;
          p_piano: E["piano_agenzia"];
          p_email: string;
          p_telefono: string;
          p_indirizzo: string;
          p_attiva: boolean;
        };
        Returns: undefined;
      };
      admin_set_user: { Args: { uid: string; p_ruolo: E["ruolo_utente"]; p_attivo: boolean }; Returns: undefined };
      can_edit_contact: { Args: { cid: string }; Returns: boolean };
      can_edit_property: { Args: { pid: string }; Returns: boolean };
      fase_label: { Args: { f: E["fase_trattativa"] }; Returns: string };
      get_my_agency_id: { Args: never; Returns: string };
      is_titolare: { Args: never; Returns: boolean };
    };
    Enums: {
      fase_trattativa: "nuovo" | "visita" | "proposta" | "compromesso" | "rogito" | "persa";
      fonte_contatto: "portale" | "sito" | "passaparola" | "social" | "altro";
      origine_task: "manuale" | "automatica";
      piano_agenzia: "start" | "pro" | "elite";
      ruolo_utente: "titolare" | "agente";
      stato_immobile: "disponibile" | "in_trattativa" | "sospeso" | "venduto" | "affittato" | "ritirato";
      stato_match: "da_proporre" | "proposto" | "interessato" | "scartato";
      temperatura_contatto: "caldo" | "tiepido" | "freddo";
      tipo_appuntamento: "visita" | "valutazione" | "firma" | "altro";
      tipo_attivita: "chiamata" | "whatsapp" | "email" | "visita" | "nota" | "cambio_fase";
      tipo_contatto: "acquirente" | "proprietario" | "entrambi" | "locatore" | "inquilino" | "collaboratore" | "altro";
      tipo_contratto: "vendita" | "affitto";
      tipo_immobile: "appartamento" | "villa" | "locale" | "terreno" | "altro";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
