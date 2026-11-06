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
        Update: {
          name?: string;
          price_monthly_cents?: number;
          price_yearly_cents?: number;
          videos_per_month?: number;
          social_accounts_max?: number;
          broll_credits_month?: number;
          brands_max?: number;
          stripe_price_monthly_id?: string | null;
          stripe_price_yearly_id?: string | null;
          active?: boolean;
        };
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
          metricool_blog_id: string | null;
          metricool_connect_url: string | null;
          metricool_connect_expires: Timestamp | null;
          billing_workspace_id: string | null;
          billing_interval: "month" | "year" | null;
          cancel_at_period_end: boolean;
          payment_failed_at: Timestamp | null;
          content_purge_warned_at: Timestamp | null;
          content_purged_at: Timestamp | null;
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
          metricool_blog_id?: string | null;
          metricool_connect_url?: string | null;
          metricool_connect_expires?: Timestamp | null;
          // Solo server (service role): abbonamento
          plan_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: "trial" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
          period_start?: Timestamp | null;
          period_end?: Timestamp | null;
          billing_interval?: "month" | "year" | null;
          cancel_at_period_end?: boolean;
          payment_failed_at?: Timestamp | null;
          founding_member?: boolean;
          content_purge_warned_at?: Timestamp | null;
          content_purged_at?: Timestamp | null;
        };
        Relationships: [];
      };
      usage_counters: {
        Row: {
          workspace_id: string;
          period_start: Timestamp;
          period_end: Timestamp;
          videos_used: number;
          broll_credits_used: number;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          type: string;
          payload: Json;
          received_at: Timestamp;
          processed_at: Timestamp | null;
          error: string | null;
        };
        Insert: { id: string; type: string; payload: Json };
        Update: { processed_at?: Timestamp | null; error?: string | null };
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
          type: "generate_scripts" | "send_email" | "transcribe" | "edit" | "render" | "publish" | "sync_social" | "retention";
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
      raw_uploads: {
        Row: {
          id: string;
          workspace_id: string;
          script_id: string | null;
          uploaded_by: string | null;
          storage_path: string;
          file_name: string;
          size_bytes: number | null;
          mime_type: string | null;
          duration_s: number | null;
          width: number | null;
          height: number | null;
          orientation: "portrait" | "landscape" | "square" | null;
          source: "upload" | "drive" | "combined";
          status: "uploaded" | "processing" | "ready" | "error";
          error: string | null;
          transcript: Json | null;
          purged_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          workspace_id: string;
          script_id?: string | null;
          uploaded_by: string | null;
          storage_path: string;
          file_name: string;
          size_bytes?: number | null;
          mime_type?: string | null;
          source?: "upload" | "drive" | "combined";
          status?: "uploaded" | "processing" | "ready" | "error";
        };
        Update: {
          size_bytes?: number | null;
          duration_s?: number | null;
          width?: number | null;
          height?: number | null;
          orientation?: "portrait" | "landscape" | "square" | null;
          status?: "uploaded" | "processing" | "ready" | "error";
          error?: string | null;
          transcript?: Json | null;
          purged_at?: Timestamp | null;
        };
        Relationships: [];
      };
      videos: {
        Row: {
          id: string;
          workspace_id: string;
          script_id: string | null;
          raw_upload_id: string;
          status: "queued" | "editing" | "internal_review" | "review" | "changes_requested" | "approved" | "scheduled" | "published" | "error";
          current_version: number;
          change_rounds_used: number;
          caption: string | null;
          hashtags: string[];
          broll_credits_used: number;
          error: string | null;
          approved_by: string | null;
          approved_at: Timestamp | null;
          quota_kind: "trial" | "plan" | null;
          billed_period_start: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          workspace_id: string;
          script_id?: string | null;
          raw_upload_id: string;
          status?: "queued" | "editing" | "internal_review" | "review" | "changes_requested" | "approved" | "scheduled" | "published" | "error";
          quota_kind?: "trial" | "plan" | null;
          billed_period_start?: Timestamp | null;
        };
        Update: {
          status?: "queued" | "editing" | "internal_review" | "review" | "changes_requested" | "approved" | "scheduled" | "published" | "error";
          current_version?: number;
          change_rounds_used?: number;
          caption?: string | null;
          hashtags?: string[];
          broll_credits_used?: number;
          error?: string | null;
          approved_by?: string | null;
          approved_at?: Timestamp | null;
          raw_upload_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "videos_raw_upload_id_fkey";
            columns: ["raw_upload_id"];
            isOneToOne: true;
            referencedRelation: "raw_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_script_id_fkey";
            columns: ["script_id"];
            isOneToOne: false;
            referencedRelation: "scripts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      video_versions: {
        Row: {
          id: string;
          video_id: string;
          workspace_id: string;
          version: number;
          edit_spec: Json | null;
          feedback_id: string | null;
          status: "pending" | "ready" | "error";
          output_path: string | null;
          thumbnail_path: string | null;
          duration_s: number | null;
          render_ms: number | null;
          created_at: Timestamp;
        };
        Insert: {
          video_id: string;
          workspace_id: string;
          version: number;
          edit_spec?: Json | null;
          feedback_id?: string | null;
        };
        Update: {
          status?: "pending" | "ready" | "error";
          output_path?: string | null;
          thumbnail_path?: string | null;
          duration_s?: number | null;
          render_ms?: number | null;
          edit_spec?: Json | null;
        };
        Relationships: [];
      };
      video_feedback: {
        Row: {
          id: string;
          video_id: string;
          version: number;
          user_id: string | null;
          message: string;
          quota_kind: "trial" | "plan" | null;
          billed_period_start: Timestamp | null;
          created_at: Timestamp;
        };
        Insert: {
          video_id: string;
          version: number;
          user_id: string;
          message: string;
          quota_kind?: "trial" | "plan" | null;
          billed_period_start?: Timestamp | null;
        };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      video_clips: {
        Row: {
          id: string;
          video_id: string;
          workspace_id: string;
          raw_upload_id: string;
          kind: "speech" | "cover";
          position: number;
          play_order: number | null;
          description: string | null;
          created_at: Timestamp;
        };
        Insert: {
          video_id: string;
          workspace_id: string;
          raw_upload_id: string;
          kind: "speech" | "cover";
          position: number;
          play_order?: number | null;
          description?: string | null;
        };
        Update: {
          play_order?: number | null;
          description?: string | null;
        };
        Relationships: [];
      };
      social_accounts: {
        Row: {
          id: string;
          workspace_id: string;
          platform: "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin";
          handle: string | null;
          provider_account_id: string | null;
          status: "connected" | "expired" | "error" | "disconnected";
          enabled: boolean;
          connected_at: Timestamp;
          last_checked_at: Timestamp | null;
        };
        Insert: {
          workspace_id: string;
          platform: "instagram" | "facebook" | "tiktok" | "youtube" | "linkedin";
          handle?: string | null;
          provider_account_id?: string | null;
          status?: "connected" | "expired" | "error" | "disconnected";
          enabled?: boolean;
          last_checked_at?: Timestamp | null;
        };
        Update: {
          handle?: string | null;
          provider_account_id?: string | null;
          status?: "connected" | "expired" | "error" | "disconnected";
          enabled?: boolean;
          last_checked_at?: Timestamp | null;
        };
        Relationships: [];
      };
      scheduled_posts: {
        Row: {
          id: string;
          video_id: string;
          workspace_id: string;
          social_account_id: string;
          scheduled_at: Timestamp;
          status: "scheduled" | "publishing" | "published" | "failed" | "canceled";
          provider_post_id: string | null;
          permalink: string | null;
          error: string | null;
          published_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          video_id: string;
          workspace_id: string;
          social_account_id: string;
          scheduled_at: Timestamp;
          status?: "scheduled" | "publishing" | "published" | "failed" | "canceled";
        };
        Update: {
          scheduled_at?: Timestamp;
          status?: "scheduled" | "publishing" | "published" | "failed" | "canceled";
          provider_post_id?: string | null;
          permalink?: string | null;
          error?: string | null;
          published_at?: Timestamp | null;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_posts_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
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
        Insert: { workspace_id?: string | null; user_id?: string | null; action: string; details?: Json };
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
      reserve_trial_video: { Args: { p_workspace_id: string }; Returns: boolean };
      release_trial_video: { Args: { p_workspace_id: string }; Returns: undefined };
      reserve_video: { Args: { p_workspace_id: string }; Returns: Json };
      release_video: { Args: { p_video_id: string }; Returns: undefined };
      release_reservation: { Args: { p_workspace_id: string; p_period_start: Timestamp | null }; Returns: undefined };
      release_feedback_quota: { Args: { p_feedback_id: string }; Returns: undefined };
      use_broll_credits: { Args: { p_workspace_id: string; p_count: number }; Returns: number };
      create_brand: {
        Args: { p_billing_workspace_id: string; p_name: string };
        Returns: Database["public"]["Tables"]["workspaces"]["Row"];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
