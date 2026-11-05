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
      script_batches: {
        Row: {
          id: string;
          workspace_id: string;
          week_start: string;
          status: "draft" | "sent" | "done";
          regenerations_used: number;
          notified_at: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          workspace_id: string;
          week_start: string;
          status?: "draft" | "sent" | "done";
        };
        Update: { status?: "draft" | "sent" | "done"; notified_at?: Timestamp | null };
        Relationships: [];
      };
      scripts: {
        Row: {
          id: string;
          batch_id: string;
          workspace_id: string;
          position: number;
          title: string;
          hook: string;
          body: string;
          call_to_action: string | null;
          shooting_notes: Json;
          format: "talking_head" | "tutorial" | "behind_the_scenes" | "product" | "testimonial";
          topic_tags: string[];
          status: "to_shoot" | "uploaded" | "skipped";
          regenerated: number;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          batch_id: string;
          workspace_id: string;
          position?: number;
          title: string;
          hook: string;
          body: string;
          call_to_action?: string | null;
          shooting_notes?: Json;
          format: "talking_head" | "tutorial" | "behind_the_scenes" | "product" | "testimonial";
          topic_tags?: string[];
          status?: "to_shoot" | "uploaded" | "skipped";
        };
        Update: {
          title?: string;
          hook?: string;
          body?: string;
          call_to_action?: string | null;
          shooting_notes?: Json;
          format?: "talking_head" | "tutorial" | "behind_the_scenes" | "product" | "testimonial";
          topic_tags?: string[];
          status?: "to_shoot" | "uploaded" | "skipped";
          regenerated?: number;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          type: "generate_scripts" | "send_email" | "transcribe" | "edit" | "render" | "publish";
          workspace_id: string | null;
          payload: Json;
          status: "queued" | "running" | "done" | "failed";
          attempts: number;
          max_attempts: number;
          last_error: string | null;
          run_after: Timestamp;
          locked_by: string | null;
          locked_at: Timestamp | null;
          dedupe_key: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
          finished_at: Timestamp | null;
        };
        Insert: { [_ in never]: never };
        Update: {
          status?: "queued" | "running" | "done" | "failed";
          attempts?: number;
          run_after?: Timestamp;
          finished_at?: Timestamp | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
      provider_costs: {
        Row: {
          id: number;
          workspace_id: string | null;
          job_id: string | null;
          video_id: string | null;
          operation: string;
          provider: string;
          model: string | null;
          cost_usd: number;
          units: Json;
          created_at: Timestamp;
        };
        Insert: {
          workspace_id?: string | null;
          job_id?: string | null;
          video_id?: string | null;
          operation: string;
          provider: string;
          model?: string | null;
          cost_usd: number;
          units?: Json;
        };
        Update: { [_ in never]: never };
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
      enqueue_job: {
        Args: {
          p_type: string;
          p_workspace_id: string | null;
          p_payload?: Json;
          p_dedupe_key?: string | null;
          p_run_after?: Timestamp;
        };
        Returns: string;
      };
      claim_job: {
        Args: { p_worker: string; p_types?: string[] | null };
        Returns: Database["public"]["Tables"]["jobs"]["Row"][];
      };
      complete_job: { Args: { p_job_id: string }; Returns: undefined };
      fail_job: { Args: { p_job_id: string; p_error: string; p_retryable?: boolean }; Returns: string | null };
      use_script_regeneration: { Args: { p_script_id: string }; Returns: number };
      refund_script_regeneration: { Args: { p_script_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
