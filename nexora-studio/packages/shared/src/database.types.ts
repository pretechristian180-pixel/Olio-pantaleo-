/**
 * Tipi del database nel formato di `supabase gen types typescript`.
 * Scritti a mano sulla migrazione della Fase 1: quando il progetto Supabase è collegato
 * si rigenerano con `npm run db:types` e questo file viene sovrascritto.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          full_name: string | null;
          phone: string | null;
          is_admin: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { [_ in never]: never };
        Update: { full_name?: string | null; phone?: string | null };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          price_monthly_cents: number;
          price_yearly_cents: number;
          videos_per_month: number;
          social_accounts_max: number;
          broll_credits_month: number;
          brands_max: number;
          stripe_price_monthly_id: string | null;
          stripe_price_yearly_id: string | null;
          sort_order: number;
          active: boolean;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          sector: string | null;
          city: string | null;
          website: string | null;
          instagram_handle: string | null;
          logo_url: string | null;
          brand_colors: Json;
          posts_per_week: number;
          posting_days: number[];
          posting_time: string;
          timezone: string;
          plan_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string;
          period_start: Timestamp | null;
          period_end: Timestamp | null;
          founding_member: boolean;
          trial_videos_left: number;
          manual_review: boolean;
          onboarding_step: number;
          onboarding_completed_at: Timestamp | null;
          created_by: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { [_ in never]: never };
        Update: {
          name?: string;
          sector?: string | null;
          city?: string | null;
          website?: string | null;
          instagram_handle?: string | null;
          logo_url?: string | null;
          brand_colors?: Json;
          posts_per_week?: number;
          posting_days?: number[];
          posting_time?: string;
          timezone?: string;
          onboarding_step?: number;
          onboarding_completed_at?: Timestamp | null;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "member";
          invited_at: Timestamp | null;
          joined_at: Timestamp;
        };
        Insert: { [_ in never]: never };
        Update: { role?: "owner" | "member" };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: "owner" | "member";
          token: string;
          invited_by: string | null;
          created_at: Timestamp;
          expires_at: Timestamp;
          accepted_at: Timestamp | null;
          revoked_at: Timestamp | null;
        };
        Insert: {
          workspace_id: string;
          email: string;
          role?: "owner" | "member";
          invited_by: string;
        };
        Update: { revoked_at?: Timestamp | null };
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          workspace_id: string;
          tone_of_voice: string | null;
          target_audience: string | null;
          services: string | null;
          do_not_say: string | null;
          edit_style: Json;
          reference_videos: string[];
          updated_at: Timestamp;
        };
        Insert: { [_ in never]: never };
        Update: {
          tone_of_voice?: string | null;
          target_audience?: string | null;
          services?: string | null;
          do_not_say?: string | null;
          edit_style?: Json;
          reference_videos?: string[];
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          workspace_id: string | null;
          user_id: string | null;
          action: string;
          details: Json;
          created_at: Timestamp;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_workspace: {
        Args: {
          p_name: string;
          p_sector?: string | null;
          p_city?: string | null;
          p_website?: string | null;
          p_instagram_handle?: string | null;
        };
        Returns: Database["public"]["Tables"]["workspaces"]["Row"];
      };
      accept_invitation: { Args: { p_token: string }; Returns: string };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          workspace_name: string;
          email: string;
          role: "owner" | "member";
          status: "open" | "accepted" | "revoked" | "expired";
        }[];
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
