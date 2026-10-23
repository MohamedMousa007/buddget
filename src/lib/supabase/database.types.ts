export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      sms_stats_outbox: {
        Row: {
          id: number
          created_at: string
          sender: string | null
          is_txn: boolean
          kw: string[]
          kw_lang: string[]
          template_id: string | null
          user_id: string | null
          bump_match: boolean
          ccy_sender: string | null
          ccy_currency: Database["public"]["Enums"]["currency_code"] | null
          ccy_confirmed: boolean | null
          skeleton_key: string | null
          sender_key: string | null
          redacted_body: string | null
          kind: string | null
          parse_method: string | null
          currency: string | null
          parsed_ok: boolean | null
        }
        Insert: {
          id?: never
          created_at?: string
          sender?: string | null
          is_txn?: boolean
          kw?: string[]
          kw_lang?: string[]
          template_id?: string | null
          user_id?: string | null
          bump_match?: boolean
          ccy_sender?: string | null
          ccy_currency?: Database["public"]["Enums"]["currency_code"] | null
          ccy_confirmed?: boolean | null
          skeleton_key?: string | null
          sender_key?: string | null
          redacted_body?: string | null
          kind?: string | null
          parse_method?: string | null
          currency?: string | null
          parsed_ok?: boolean | null
        }
        Update: {
          kw?: string[]
        }
        Relationships: []
      }
      sms_corpus: {
        Row: {
          skeleton_key: string
          sender_key: string | null
          redacted_body: string
          kind: string | null
          parse_method: string | null
          currency: string | null
          matched_template_id: string | null
          seen_count: number
          ok_count: number
          first_seen: string
          last_seen: string
        }
        Insert: {
          skeleton_key: string
          sender_key?: string | null
          redacted_body: string
          kind?: string | null
          parse_method?: string | null
          currency?: string | null
          matched_template_id?: string | null
          seen_count?: number
          ok_count?: number
          first_seen?: string
          last_seen?: string
        }
        Update: {
          seen_count?: number
        }
        Relationships: []
      }
      admin_metrics_cache: {
        Row: {
          key: string
          value: Json
          computed_at: string
        }
        Insert: {
          key: string
          value: Json
          computed_at?: string
        }
        Update: {
          key?: string
          value?: Json
          computed_at?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          id: string
          created_at: string
          user_id: string | null
          to_email: string
          template_key: string
          locale: string
          provider_message_id: string | null
          status: string
          error: string | null
          latency_ms: number | null
          source: string
          is_test: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          user_id?: string | null
          to_email: string
          template_key: string
          locale: string
          provider_message_id?: string | null
          status: string
          error?: string | null
          latency_ms?: number | null
          source: string
          is_test?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string | null
          to_email?: string
          template_key?: string
          locale?: string
          provider_message_id?: string | null
          status?: string
          error?: string | null
          latency_ms?: number | null
          source?: string
          is_test?: boolean
        }
        Relationships: []
      }
      email_scenarios: {
        Row: {
          key: string
          name: string
          description: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          key: string
          name: string
          description?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          key?: string
          name?: string
          description?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      email_template_versions: {
        Row: {
          id: string
          key: string
          locale: string
          version: number
          subject: string
          preheader: string
          html: string
          mode: string
          blocks: Json
          published_by: string | null
          published_at: string
        }
        Insert: {
          id?: string
          key: string
          locale: string
          version: number
          subject: string
          preheader?: string
          html: string
          mode: string
          blocks?: Json
          published_by?: string | null
          published_at?: string
        }
        Update: {
          id?: string
          key?: string
          locale?: string
          version?: number
          subject?: string
          preheader?: string
          html?: string
          mode?: string
          blocks?: Json
          published_by?: string | null
          published_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          id: string
          key: string
          locale: string
          subject: string
          preheader: string
          html: string
          mode: string
          blocks: Json
          status: string
          version: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          locale: string
          subject: string
          preheader?: string
          html: string
          mode?: string
          blocks?: Json
          status: string
          version: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          locale?: string
          subject?: string
          preheader?: string
          html?: string
          mode?: string
          blocks?: Json
          status?: string
          version?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      account_adjustments: {
        Row: { id: string; user_id: string; payment_method_id: string; delta: number; reason: string; occurred_at: string; note: string | null; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; user_id: string; payment_method_id: string; delta: number; reason: string; occurred_at?: string; note?: string | null; created_at?: string; updated_at?: string; deleted_at?: string | null }
        Update: { id?: string; user_id?: string; payment_method_id?: string; delta?: number; reason?: string; occurred_at?: string; note?: string | null; created_at?: string; updated_at?: string; deleted_at?: string | null }
        Relationships: []
      }
      account_balance_reports: {
        Row: { id: string; user_id: string; payment_method_id: string; balance: number; currency: string | null; reported_at: string; source: string; sms_parse_log_id: string | null; created_at: string }
        Insert: { id?: string; user_id: string; payment_method_id: string; balance: number; currency?: string | null; reported_at: string; source?: string; sms_parse_log_id?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; payment_method_id?: string; balance?: number; currency?: string | null; reported_at?: string; source?: string; sms_parse_log_id?: string | null; created_at?: string }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: number
          ip: string | null
          metadata: Json
          summary: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: never
          ip?: string | null
          metadata?: Json
          summary?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: never
          ip?: string | null
          metadata?: Json
          summary?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_biometric_devices: {
        Row: {
          created_at: string
          device_id: string
          label: string | null
          last_used_at: string | null
          platform: string | null
          secret_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          label?: string | null
          last_used_at?: string | null
          platform?: string | null
          secret_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          label?: string | null
          last_used_at?: string | null
          platform?: string | null
          secret_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_credentials: {
        Row: {
          created_at: string
          failed_attempts: number
          locked_until: string | null
          password_changed_at: string
          password_hash: string
          recovery_hashes: string[]
          setup_completed_at: string | null
          sso_enabled: boolean
          totp_confirmed_at: string | null
          totp_last_step: number | null
          totp_secret_enc: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          password_changed_at?: string
          password_hash: string
          recovery_hashes?: string[]
          setup_completed_at?: string | null
          sso_enabled?: boolean
          totp_confirmed_at?: string | null
          totp_last_step?: number | null
          totp_secret_enc?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          password_changed_at?: string
          password_hash?: string
          recovery_hashes?: string[]
          setup_completed_at?: string | null
          sso_enabled?: boolean
          totp_confirmed_at?: string | null
          totp_last_step?: number | null
          totp_secret_enc?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          created_at: string
          description: string
          is_system: boolean
          key: string
          name: string
          permissions: string[]
          rank: number
        }
        Insert: {
          created_at?: string
          description?: string
          is_system?: boolean
          key: string
          name: string
          permissions?: string[]
          rank: number
        }
        Update: {
          created_at?: string
          description?: string
          is_system?: boolean
          key?: string
          name?: string
          permissions?: string[]
          rank?: number
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          last_seen_at: string
          method: string
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          method: string
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          method?: string
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_staff: {
        Row: {
          created_at: string
          department: string | null
          display_name: string | null
          email: string
          extra_permissions: string[]
          id: string
          invited_by: string | null
          last_login_at: string | null
          role_key: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          email: string
          extra_permissions?: string[]
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          role_key: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string
          extra_permissions?: string[]
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          role_key?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_staff_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_staff_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      admin_user_notes: {
        Row: {
          author_label: string | null
          body: string
          created_at: string
          id: string
          pinned: boolean
          staff_id: string | null
          user_id: string
        }
        Insert: {
          author_label?: string | null
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          staff_id?: string | null
          user_id: string
        }
        Update: {
          author_label?: string | null
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          staff_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chats: {
        Row: {
          chat_id: string
          closed: boolean
          last_at: string
          started_at: string
          turns: number
          units: number
          user_id: string
        }
        Insert: {
          chat_id?: string
          closed?: boolean
          last_at?: string
          started_at?: string
          turns?: number
          units?: number
          user_id: string
        }
        Update: {
          chat_id?: string
          closed?: boolean
          last_at?: string
          started_at?: string
          turns?: number
          units?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_reservations: {
        Row: {
          chat_id: string | null
          created_at: string
          est_units: number
          expires_at: string
          feature: string
          id: string
          settled: boolean
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          est_units?: number
          expires_at: string
          feature: string
          id?: string
          settled?: boolean
          user_id: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          est_units?: number
          expires_at?: string
          feature?: string
          id?: string
          settled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reservations_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "ai_chats"
            referencedColumns: ["chat_id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          cached_tokens: number
          chat_id: string | null
          created_at: string
          feature: string
          id: number
          in_tokens: number
          latency_ms: number | null
          model: string | null
          out_tokens: number
          status: string
          tier: string | null
          units: number
          user_id: string
        }
        Insert: {
          cached_tokens?: number
          chat_id?: string | null
          created_at?: string
          feature: string
          id?: never
          in_tokens?: number
          latency_ms?: number | null
          model?: string | null
          out_tokens?: number
          status?: string
          tier?: string | null
          units?: number
          user_id: string
        }
        Update: {
          cached_tokens?: number
          chat_id?: string | null
          created_at?: string
          feature?: string
          id?: never
          in_tokens?: number
          latency_ms?: number | null
          model?: string | null
          out_tokens?: number
          status?: string
          tier?: string | null
          units?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "ai_chats"
            referencedColumns: ["chat_id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      app_analytics_daily: {
        Row: {
          active_seconds: number
          day: string
          first_event_at: string
          heartbeats: number
          last_event_at: string
          paths: Json
          sessions: number
          user_id: string
          visibility_events: number
        }
        Insert: {
          active_seconds?: number
          day: string
          first_event_at: string
          heartbeats?: number
          last_event_at: string
          paths?: Json
          sessions?: number
          user_id: string
          visibility_events?: number
        }
        Update: {
          active_seconds?: number
          day?: string
          first_event_at?: string
          heartbeats?: number
          last_event_at?: string
          paths?: Json
          sessions?: number
          user_id?: string
          visibility_events?: number
        }
        Relationships: []
      }
      app_analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          metadata: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          metadata?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      asset_prices: {
        Row: {
          as_of: string
          asset_class: string
          confidence: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          price: number
          source: string | null
          symbol: string
          updated_at: string
          upstream: string | null
        }
        Insert: {
          as_of: string
          asset_class: string
          confidence?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          price: number
          source?: string | null
          symbol: string
          updated_at?: string
          upstream?: string | null
        }
        Update: {
          as_of?: string
          asset_class?: string
          confidence?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          price?: number
          source?: string | null
          symbol?: string
          updated_at?: string
          upstream?: string | null
        }
        Relationships: []
      }
      biometric_devices: {
        Row: {
          created_at: string
          device_id: string
          last_used_at: string | null
          secret_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          last_used_at?: string | null
          secret_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          last_used_at?: string | null
          secret_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      buddgy_memories: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          source: string
          status: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          source?: string
          status?: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          source?: string
          status?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          amount: number
          block: string
          confidence: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          due_day: number | null
          essential: boolean
          expense_categories: string[]
          icon: string
          id: string
          is_savings: boolean
          link_ids: string[]
          link_type: string
          locked: boolean
          name: string
          plan_id: string
          rationale: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          block?: string
          confidence?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          due_day?: number | null
          essential?: boolean
          expense_categories?: string[]
          icon?: string
          id?: string
          is_savings?: boolean
          link_ids?: string[]
          link_type?: string
          locked?: boolean
          name: string
          plan_id: string
          rationale?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          block?: string
          confidence?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          due_day?: number | null
          essential?: boolean
          expense_categories?: string[]
          icon?: string
          id?: string
          is_savings?: boolean
          link_ids?: string[]
          link_type?: string
          locked?: boolean
          name?: string
          plan_id?: string
          rationale?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "budget_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_feedback: {
        Row: {
          budget_after: Json
          budget_before: Json
          created_at: string
          feedback_text: string
          id: string
          ops: Json | null
          outcome: string | null
          plan_id: string | null
          user_id: string
        }
        Insert: {
          budget_after?: Json
          budget_before?: Json
          created_at?: string
          feedback_text: string
          id?: string
          ops?: Json | null
          outcome?: string | null
          plan_id?: string | null
          user_id: string
        }
        Update: {
          budget_after?: Json
          budget_before?: Json
          created_at?: string
          feedback_text?: string
          id?: string
          ops?: Json | null
          outcome?: string | null
          plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_feedback_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "budget_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_plan_activations: {
        Row: {
          created_at: string
          deleted_at: string | null
          effective_from: string
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          effective_from: string
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          effective_from?: string
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_plan_activations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "budget_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_plans: {
        Row: {
          buddgy_flow: Json | null
          buddgy_guided_complete: boolean
          created_at: string
          deleted_at: string | null
          engine_version: string | null
          household: Database["public"]["Enums"]["budget_household"] | null
          id: string
          income_override: number | null
          intent: string
          name: string
          origin: string
          rationale: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buddgy_flow?: Json | null
          buddgy_guided_complete?: boolean
          created_at?: string
          deleted_at?: string | null
          engine_version?: string | null
          household?: Database["public"]["Enums"]["budget_household"] | null
          id?: string
          income_override?: number | null
          intent?: string
          name: string
          origin?: string
          rationale?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buddgy_flow?: Json | null
          buddgy_guided_complete?: boolean
          created_at?: string
          deleted_at?: string | null
          engine_version?: string | null
          household?: Database["public"]["Enums"]["budget_household"] | null
          id?: string
          income_override?: number | null
          intent?: string
          name?: string
          origin?: string
          rationale?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_subcategories: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_id: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          occurred_at: string | null
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          debt_id: string
          deleted_at: string | null
          funded_from_savings: boolean
          id: string
          notes: string | null
          payment_date: string
          payment_method_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          occurred_at?: string | null
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_id: string
          deleted_at?: string | null
          funded_from_savings?: boolean
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          occurred_at?: string | null
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_id?: string
          deleted_at?: string | null
          funded_from_savings?: boolean
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          amount: number
          cleared_at: string | null
          created_at: string
          credit_limit: number | null
          creditor: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          debt_type: Database["public"]["Enums"]["debt_kind"]
          deleted_at: string | null
          description: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          gold_karat: Database["public"]["Enums"]["gold_karat"] | null
          grace_period_days: number | null
          id: string
          installment_amount: number | null
          installment_count: number | null
          installment_frequency:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_name: string | null
          installment_provider:
            | Database["public"]["Enums"]["installment_provider"]
            | null
          installment_provider_name: string | null
          installment_start_date: string | null
          interest_free: boolean
          interest_rate: number
          is_gold: boolean
          linked_credit_card_debt_id: string | null
          linked_payment_method_id: string | null
          minimum_payment_percent: number | null
          name: string
          notes: string | null
          payment_due_day: number | null
          person: string | null
          received_via: Database["public"]["Enums"]["debt_received_via"] | null
          relationship: string | null
          remaining_amount: number | null
          started_at: string | null
          starting_balance: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          cleared_at?: string | null
          created_at?: string
          credit_limit?: number | null
          creditor?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_type?: Database["public"]["Enums"]["debt_kind"]
          deleted_at?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          gold_karat?: Database["public"]["Enums"]["gold_karat"] | null
          grace_period_days?: number | null
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          installment_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_name?: string | null
          installment_provider?:
            | Database["public"]["Enums"]["installment_provider"]
            | null
          installment_provider_name?: string | null
          installment_start_date?: string | null
          interest_free?: boolean
          interest_rate?: number
          is_gold?: boolean
          linked_credit_card_debt_id?: string | null
          linked_payment_method_id?: string | null
          minimum_payment_percent?: number | null
          name: string
          notes?: string | null
          payment_due_day?: number | null
          person?: string | null
          received_via?: Database["public"]["Enums"]["debt_received_via"] | null
          relationship?: string | null
          remaining_amount?: number | null
          started_at?: string | null
          starting_balance?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cleared_at?: string | null
          created_at?: string
          credit_limit?: number | null
          creditor?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_type?: Database["public"]["Enums"]["debt_kind"]
          deleted_at?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          gold_karat?: Database["public"]["Enums"]["gold_karat"] | null
          grace_period_days?: number | null
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          installment_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_name?: string | null
          installment_provider?:
            | Database["public"]["Enums"]["installment_provider"]
            | null
          installment_provider_name?: string | null
          installment_start_date?: string | null
          interest_free?: boolean
          interest_rate?: number
          is_gold?: boolean
          linked_credit_card_debt_id?: string | null
          linked_payment_method_id?: string | null
          minimum_payment_percent?: number | null
          name?: string
          notes?: string | null
          payment_due_day?: number | null
          person?: string | null
          received_via?: Database["public"]["Enums"]["debt_received_via"] | null
          relationship?: string | null
          remaining_amount?: number | null
          started_at?: string | null
          starting_balance?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_linked_credit_card_debt_id_fkey"
            columns: ["linked_credit_card_debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_linked_payment_method_id_fkey"
            columns: ["linked_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          occurred_at: string | null
          to_payment_method_id: string | null
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          description: string | null
          expense_date: string
          id: string
          is_debt_payment: boolean
          linked_debt_id: string | null
          linked_debt_payment_id: string | null
          linked_subscription_id: string | null
          notes: string | null
          payment_method_id: string | null
          receipt_id: string | null
          refund_kind: string | null
          refund_sms_log_id: string | null
          refunded_at: string | null
          sms_log_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          occurred_at?: string | null
          to_payment_method_id?: string | null
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_debt_payment?: boolean
          linked_debt_id?: string | null
          linked_debt_payment_id?: string | null
          linked_subscription_id?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          refund_kind?: string | null
          refund_sms_log_id?: string | null
          refunded_at?: string | null
          sms_log_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          occurred_at?: string | null
          to_payment_method_id?: string | null
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_debt_payment?: boolean
          linked_debt_id?: string | null
          linked_debt_payment_id?: string | null
          linked_subscription_id?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          refund_kind?: string | null
          refund_sms_log_id?: string | null
          refunded_at?: string | null
          sms_log_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_linked_debt_id_fkey"
            columns: ["linked_debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_linked_debt_payment_id_fkey"
            columns: ["linked_debt_payment_id"]
            isOneToOne: false
            referencedRelation: "debt_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_linked_subscription_id_fkey"
            columns: ["linked_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_refund_sms_log_id_fkey"
            columns: ["refund_sms_log_id"]
            isOneToOne: false
            referencedRelation: "sms_parse_log"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          key: string
          plan_keys: string[]
          platforms: string[]
          rollout_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          key: string
          plan_keys?: string[]
          platforms?: string[]
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          key?: string
          plan_keys?: string[]
          platforms?: string[]
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_allocation_runs: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          period: string
          planned: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          goal_id: string
          id?: string
          period: string
          planned?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          period?: string
          planned?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_allocation_runs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          achieved_at: string | null
          category: Database["public"]["Enums"]["goal_category"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          emoji: string
          frequency: string
          funding_mode: string
          id: string
          linked_debt_ids: string[]
          linked_savings_account_ids: string[]
          manual_current_amount: number
          monthly_contribution: number | null
          monthly_spending_limit: number | null
          name: string
          notes: string | null
          plan_start: string | null
          priority: number
          share_pct: number | null
          spending_category: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number | null
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          category?: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          emoji?: string
          frequency?: string
          funding_mode?: string
          id?: string
          linked_debt_ids?: string[]
          linked_savings_account_ids?: string[]
          manual_current_amount?: number
          monthly_contribution?: number | null
          monthly_spending_limit?: number | null
          name: string
          notes?: string | null
          plan_start?: string | null
          priority?: number
          share_pct?: number | null
          spending_category?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          category?: Database["public"]["Enums"]["goal_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          emoji?: string
          frequency?: string
          funding_mode?: string
          id?: string
          linked_debt_ids?: string[]
          linked_savings_account_ids?: string[]
          manual_current_amount?: number
          monthly_contribution?: number | null
          monthly_spending_limit?: number | null
          name?: string
          notes?: string | null
          plan_start?: string | null
          priority?: number
          share_pct?: number | null
          spending_category?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      income_events: {
        Row: {
          occurred_at: string | null
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          id: string
          linked_debt_id: string | null
          linked_savings_account_id: string | null
          name: string
          notes: string | null
          occurrence_date: string | null
          payment_method_id: string | null
          received_date: string
          shared_plan_id: string | null
          sms_log_id: string | null
          source_type: Database["public"]["Enums"]["income_source_type"]
          status: Database["public"]["Enums"]["income_event_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          occurred_at?: string | null
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          linked_debt_id?: string | null
          linked_savings_account_id?: string | null
          name: string
          notes?: string | null
          occurrence_date?: string | null
          payment_method_id?: string | null
          received_date: string
          shared_plan_id?: string | null
          sms_log_id?: string | null
          source_type?: Database["public"]["Enums"]["income_source_type"]
          status?: Database["public"]["Enums"]["income_event_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          occurred_at?: string | null
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          linked_debt_id?: string | null
          linked_savings_account_id?: string | null
          name?: string
          notes?: string | null
          occurrence_date?: string | null
          payment_method_id?: string | null
          received_date?: string
          shared_plan_id?: string | null
          sms_log_id?: string | null
          source_type?: Database["public"]["Enums"]["income_source_type"]
          status?: Database["public"]["Enums"]["income_event_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      income_sources: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          day_of_month: number | null
          deleted_at: string | null
          effective_end: string | null
          effective_start: string
          id: string
          is_recurring: boolean
          linked_debt_id: string | null
          linked_savings_account_id: string | null
          name: string
          notes: string | null
          payday_days: number[] | null
          payday_drift_days: number | null
          payment_method_id: string | null
          recurring_frequency:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          shared_plan_id: string | null
          sort_order: number | null
          source_type: Database["public"]["Enums"]["income_source_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          deleted_at?: string | null
          effective_end?: string | null
          effective_start: string
          id?: string
          is_recurring?: boolean
          linked_debt_id?: string | null
          linked_savings_account_id?: string | null
          name: string
          notes?: string | null
          payday_days?: number[] | null
          payday_drift_days?: number | null
          payment_method_id?: string | null
          recurring_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          shared_plan_id?: string | null
          sort_order?: number | null
          source_type?: Database["public"]["Enums"]["income_source_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          deleted_at?: string | null
          effective_end?: string | null
          effective_start?: string
          id?: string
          is_recurring?: boolean
          linked_debt_id?: string | null
          linked_savings_account_id?: string | null
          name?: string
          notes?: string | null
          payday_days?: number[] | null
          payday_drift_days?: number | null
          payment_method_id?: string | null
          recurring_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          shared_plan_id?: string | null
          sort_order?: number | null
          source_type?: Database["public"]["Enums"]["income_source_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_sources_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      live_market_data: {
        Row: {
          asset_name: string
          asset_symbol: string
          asset_type: string
          change_24h: number | null
          current_price: number
          id: string
          last_fetch: string | null
          source: string | null
        }
        Insert: {
          asset_name: string
          asset_symbol: string
          asset_type: string
          change_24h?: number | null
          current_price: number
          id?: string
          last_fetch?: string | null
          source?: string | null
        }
        Update: {
          asset_name?: string
          asset_symbol?: string
          asset_type?: string
          change_24h?: number | null
          current_price?: number
          id?: string
          last_fetch?: string | null
          source?: string | null
        }
        Relationships: []
      }
      loyalty_accounts: {
        Row: {
          lifetime_points: number
          points_balance: number
          tier_key: string | null
          tier_locked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          lifetime_points?: number
          points_balance?: number
          tier_key?: string | null
          tier_locked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          lifetime_points?: number
          points_balance?: number
          tier_key?: string | null
          tier_locked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_tier_key_fkey"
            columns: ["tier_key"]
            isOneToOne: false
            referencedRelation: "loyalty_tiers"
            referencedColumns: ["key"]
          },
        ]
      }
      loyalty_ledger: {
        Row: {
          actor_id: string | null
          created_at: string
          delta: number
          id: number
          reason: string
          ref: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          id?: never
          reason: string
          ref?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          id?: never
          reason?: string
          ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          color: string | null
          created_at: string
          description: string
          key: string
          min_points: number
          name: string
          perks: Json
          sort_order: number
          status: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string
          key: string
          min_points?: number
          name: string
          perks?: Json
          sort_order?: number
          status?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string
          key?: string
          min_points?: number
          name?: string
          perks?: Json
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      merchant_categories: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          hit_count: number
          merchant_key: string
          sample_merchant: string | null
          source: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["expense_category"]
          hit_count?: number
          merchant_key: string
          sample_merchant?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          hit_count?: number
          merchant_key?: string
          sample_merchant?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          basis: string
          created_at: string
          currency: string
          day: string
          net_worth: number
          user_id: string
        }
        Insert: {
          basis?: string
          created_at?: string
          currency: string
          day: string
          net_worth: number
          user_id: string
        }
        Update: {
          basis?: string
          created_at?: string
          currency?: string
          day?: string
          net_worth?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          parent_id: string | null
          opening_balance: number | null
          opening_at: string | null
          closed_at: string | null
          track_sms: boolean
          color: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          id: string
          is_default: boolean
          last4: string | null
          name: string
          notes: string | null
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          parent_id?: string | null
          opening_balance?: number | null
          opening_at?: string | null
          closed_at?: string | null
          track_sms?: boolean
          color?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          name: string
          notes?: string | null
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          parent_id?: string | null
          opening_balance?: number | null
          opening_at?: string | null
          closed_at?: string | null
          track_sms?: boolean
          color?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          name?: string
          notes?: string | null
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          description: string
          features: string[]
          is_default: boolean
          key: string
          limits: Json
          name: string
          price_monthly_cents: number | null
          price_yearly_cents: number | null
          sort_order: number
          status: string
          trial_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string
          features?: string[]
          is_default?: boolean
          key: string
          limits?: Json
          name: string
          price_monthly_cents?: number | null
          price_yearly_cents?: number | null
          sort_order?: number
          status?: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          features?: string[]
          is_default?: boolean
          key?: string
          limits?: Json
          name?: string
          price_monthly_cents?: number | null
          price_yearly_cents?: number | null
          sort_order?: number
          status?: string
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          welcome_email_sent_at: string | null
          data_reset_at: string | null
          active_budget_plan_id: string | null
          active_shared_budget_id: string | null
          avatar_emoji: string | null
          avatar_image_path: string | null
          base_currency: Database["public"]["Enums"]["currency_code"]
          city: string | null
          country: string | null
          created_at: string
          default_carry_pocket_id: string | null
          default_shared_budget_plan_id: string | null
          display_name: string | null
          email: string | null
          emergency_fund_config: Json
          financial_goals_notes: string
          financial_profile: Json | null
          food_frequency: string | null
          gender: string | null
          household: string | null
          id: string
          lifestyle_tier: string | null
          monthly_rent: number | null
          name: string
          phone: string | null
          rent_includes_utilities: boolean
          secondary_currency:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode: string | null
          updated_at: string
          zakat_config: Json
        }
        Insert: {
          welcome_email_sent_at?: string | null
          data_reset_at?: string | null
          active_budget_plan_id?: string | null
          active_shared_budget_id?: string | null
          avatar_emoji?: string | null
          avatar_image_path?: string | null
          base_currency?: Database["public"]["Enums"]["currency_code"]
          city?: string | null
          country?: string | null
          created_at?: string
          default_carry_pocket_id?: string | null
          default_shared_budget_plan_id?: string | null
          display_name?: string | null
          email?: string | null
          emergency_fund_config?: Json
          financial_goals_notes?: string
          financial_profile?: Json | null
          food_frequency?: string | null
          gender?: string | null
          household?: string | null
          id: string
          lifestyle_tier?: string | null
          monthly_rent?: number | null
          name?: string
          phone?: string | null
          rent_includes_utilities?: boolean
          secondary_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode?: string | null
          updated_at?: string
          zakat_config?: Json
        }
        Update: {
          welcome_email_sent_at?: string | null
          data_reset_at?: string | null
          active_budget_plan_id?: string | null
          active_shared_budget_id?: string | null
          avatar_emoji?: string | null
          avatar_image_path?: string | null
          base_currency?: Database["public"]["Enums"]["currency_code"]
          city?: string | null
          country?: string | null
          created_at?: string
          default_carry_pocket_id?: string | null
          default_shared_budget_plan_id?: string | null
          display_name?: string | null
          email?: string | null
          emergency_fund_config?: Json
          financial_goals_notes?: string
          financial_profile?: Json | null
          food_frequency?: string | null
          gender?: string | null
          household?: string | null
          id?: string
          lifestyle_tier?: string | null
          monthly_rent?: number | null
          name?: string
          phone?: string | null
          rent_includes_utilities?: boolean
          secondary_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode?: string | null
          updated_at?: string
          zakat_config?: Json
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          app_version: string | null
          device_model: string | null
          id: string
          locale: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          device_model?: string | null
          id?: string
          locale?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          device_model?: string | null
          id?: string
          locale?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          charges: Json
          confidence: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          id: string
          items: Json
          merchant: string | null
          notes: string | null
          payment_method_id: string | null
          receipt_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          charges?: Json
          confidence?: number | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          items?: Json
          merchant?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          charges?: Json
          confidence?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          items?: Json
          merchant?: string | null
          notes?: string | null
          payment_method_id?: string | null
          receipt_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_debt_payments: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          day_of_month: number | null
          debt_id: string
          deleted_at: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          is_active: boolean
          next_due_date: string | null
          notes: string | null
          payment_method_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          debt_id: string
          deleted_at?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          next_due_date?: string | null
          notes?: string | null
          payment_method_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          debt_id?: string
          deleted_at?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          next_due_date?: string | null
          notes?: string | null
          payment_method_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_debt_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          day_of_month: number | null
          deleted_at: string | null
          description: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          is_active: boolean
          linked_subscription_id: string | null
          next_due_date: string | null
          notes: string | null
          payment_method_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          deleted_at?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          linked_subscription_id?: string | null
          next_due_date?: string | null
          notes?: string | null
          payment_method_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          deleted_at?: string | null
          description?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          linked_subscription_id?: string | null
          next_due_date?: string | null
          notes?: string | null
          payment_method_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_linked_subscription_id_fkey"
            columns: ["linked_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_savings_deposits: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          day_of_month: number | null
          deleted_at: string | null
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          is_active: boolean
          next_due_date: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          deleted_at?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          next_due_date?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          deleted_at?: string | null
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          next_due_date?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_savings_deposits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_accounts: {
        Row: {
          held_in_payment_method_id: string | null
          category: Database["public"]["Enums"]["savings_category"]
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_balance: number
          deleted_at: string | null
          icon: string | null
          id: string
          is_emergency_cover: boolean
          linked_payment_method_id: string | null
          metadata: Json
          name: string
          notes: string | null
          opening_balance: number
          type: Database["public"]["Enums"]["savings_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          held_in_payment_method_id?: string | null
          category?: Database["public"]["Enums"]["savings_category"]
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          deleted_at?: string | null
          icon?: string | null
          id?: string
          is_emergency_cover?: boolean
          linked_payment_method_id?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["savings_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          held_in_payment_method_id?: string | null
          category?: Database["public"]["Enums"]["savings_category"]
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          deleted_at?: string | null
          icon?: string | null
          id?: string
          is_emergency_cover?: boolean
          linked_payment_method_id?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["savings_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_holdings: {
        Row: {
          account_id: string | null
          asset_name: string | null
          asset_symbol: string
          asset_type: Database["public"]["Enums"]["savings_type"]
          cost_basis_currency:
            | Database["public"]["Enums"]["currency_code"]
            | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_value: number | null
          deleted_at: string | null
          id: string
          initial_amount: number | null
          karat: number | null
          karat_adjustment: number
          karat_unconfirmed: boolean
          metadata: Json
          notes: string | null
          purchase_date: string | null
          quantity: number
          unit_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          asset_name?: string | null
          asset_symbol: string
          asset_type?: Database["public"]["Enums"]["savings_type"]
          cost_basis_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_value?: number | null
          deleted_at?: string | null
          id?: string
          initial_amount?: number | null
          karat?: number | null
          karat_adjustment?: number
          karat_unconfirmed?: boolean
          metadata?: Json
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
          unit_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          asset_name?: string | null
          asset_symbol?: string
          asset_type?: Database["public"]["Enums"]["savings_type"]
          cost_basis_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_value?: number | null
          deleted_at?: string | null
          id?: string
          initial_amount?: number | null
          karat?: number | null
          karat_adjustment?: number
          karat_unconfirmed?: boolean
          metadata?: Json
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
          unit_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_month_summary: {
        Row: {
          allocated: number
          carry: number
          carry_adjustment: number
          closed_at: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          month_key: string
          pocket_id: string | null
          saved: number
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allocated?: number
          carry?: number
          carry_adjustment?: number
          closed_at?: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          month_key: string
          pocket_id?: string | null
          saved?: number
          target?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allocated?: number
          carry?: number
          carry_adjustment?: number
          closed_at?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          month_key?: string
          pocket_id?: string | null
          saved?: number
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_transactions: {
        Row: {
          occurred_at: string | null
          payment_method_id: string | null
          account_id: string
          amount: number
          balance_after: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          id: string
          is_auto_save: boolean
          is_cash_flow: boolean
          kind: Database["public"]["Enums"]["savings_transaction_kind"]
          notes: string | null
          source: string | null
          transaction_date: string
          transfer_group_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          occurred_at?: string | null
          payment_method_id?: string | null
          account_id: string
          amount: number
          balance_after?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          is_auto_save?: boolean
          is_cash_flow?: boolean
          kind: Database["public"]["Enums"]["savings_transaction_kind"]
          notes?: string | null
          source?: string | null
          transaction_date?: string
          transfer_group_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          occurred_at?: string | null
          payment_method_id?: string | null
          account_id?: string
          amount?: number
          balance_after?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          id?: string
          is_auto_save?: boolean
          is_cash_flow?: boolean
          kind?: Database["public"]["Enums"]["savings_transaction_kind"]
          notes?: string | null
          source?: string | null
          transaction_date?: string
          transfer_group_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_corrections: {
        Row: {
          body_shape_key: string
          confidence: number | null
          corrected_fields: Json
          created_at: string
          id: string
          redacted_body: string
          revoked_at: string | null
          source_signal_id: string | null
          source_template_id: string | null
        }
        Insert: {
          body_shape_key: string
          confidence?: number | null
          corrected_fields: Json
          created_at?: string
          id?: string
          redacted_body: string
          revoked_at?: string | null
          source_signal_id?: string | null
          source_template_id?: string | null
        }
        Update: {
          body_shape_key?: string
          confidence?: number | null
          corrected_fields?: Json
          created_at?: string
          id?: string
          redacted_body?: string
          revoked_at?: string | null
          source_signal_id?: string | null
          source_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_corrections_source_signal_id_fkey"
            columns: ["source_signal_id"]
            isOneToOne: false
            referencedRelation: "sms_template_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_corrections_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_ingest_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          is_active: boolean
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_keyword_pool: {
        Row: {
          first_seen: string
          hit_count: number
          keyword: string
          lang: string | null
          last_seen: string
        }
        Insert: {
          first_seen?: string
          hit_count?: number
          keyword: string
          lang?: string | null
          last_seen?: string
        }
        Update: {
          first_seen?: string
          hit_count?: number
          keyword?: string
          lang?: string | null
          last_seen?: string
        }
        Relationships: []
      }
      sms_parse_log: {
        Row: {
          payment_method_id: string | null
          balance_after: number | null
          harvested_at: string | null
          account_last4: string | null
          acked_at: string | null
          amount: number | null
          awaiting_confirmation: boolean
          bank_name: string | null
          category: string | null
          clean_title: string | null
          confidence: number | null
          confirmed_at: string | null
          counterparty_last4: string | null
          created_at: string
          currency: string | null
          debt_payment_id: string | null
          expense_id: string | null
          failure_code: string | null
          id: string
          income_id: string | null
          is_duplicate: boolean
          kind: string | null
          learn_status: string | null
          learn_template_id: string | null
          matched_template_id: string | null
          merchant: string | null
          merchant_normalized: string | null
          paired_log_id: string | null
          parse_method: string | null
          parsed_at: string | null
          parsed_ok: boolean
          pattern_id: string | null
          payment_instrument: string | null
          push_result: Json | null
          pushed_at: string | null
          raw_body: string
          raw_sms_summary: string | null
          received_at: string
          savings_transaction_id: string | null
          sender: string | null
          sms_hash: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          payment_method_id?: string | null
          balance_after?: number | null
          harvested_at?: string | null
          account_last4?: string | null
          acked_at?: string | null
          amount?: number | null
          awaiting_confirmation?: boolean
          bank_name?: string | null
          category?: string | null
          clean_title?: string | null
          confidence?: number | null
          confirmed_at?: string | null
          counterparty_last4?: string | null
          created_at?: string
          currency?: string | null
          debt_payment_id?: string | null
          expense_id?: string | null
          failure_code?: string | null
          id?: string
          income_id?: string | null
          is_duplicate?: boolean
          kind?: string | null
          learn_status?: string | null
          learn_template_id?: string | null
          matched_template_id?: string | null
          merchant?: string | null
          merchant_normalized?: string | null
          paired_log_id?: string | null
          parse_method?: string | null
          parsed_at?: string | null
          parsed_ok?: boolean
          pattern_id?: string | null
          payment_instrument?: string | null
          push_result?: Json | null
          pushed_at?: string | null
          raw_body: string
          raw_sms_summary?: string | null
          received_at?: string
          savings_transaction_id?: string | null
          sender?: string | null
          sms_hash?: string | null
          source: string
          status?: string
          user_id: string
        }
        Update: {
          payment_method_id?: string | null
          balance_after?: number | null
          harvested_at?: string | null
          account_last4?: string | null
          acked_at?: string | null
          amount?: number | null
          awaiting_confirmation?: boolean
          bank_name?: string | null
          category?: string | null
          clean_title?: string | null
          confidence?: number | null
          confirmed_at?: string | null
          counterparty_last4?: string | null
          created_at?: string
          currency?: string | null
          debt_payment_id?: string | null
          expense_id?: string | null
          failure_code?: string | null
          id?: string
          income_id?: string | null
          is_duplicate?: boolean
          kind?: string | null
          learn_status?: string | null
          learn_template_id?: string | null
          matched_template_id?: string | null
          merchant?: string | null
          merchant_normalized?: string | null
          paired_log_id?: string | null
          parse_method?: string | null
          parsed_at?: string | null
          parsed_ok?: boolean
          pattern_id?: string | null
          payment_instrument?: string | null
          push_result?: Json | null
          pushed_at?: string | null
          raw_body?: string
          raw_sms_summary?: string | null
          received_at?: string
          savings_transaction_id?: string | null
          sender?: string | null
          sms_hash?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_parse_log_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_parse_log_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: false
            referencedRelation: "income_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_parse_log_matched_template_id_fkey"
            columns: ["matched_template_id"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_promotion_config: {
        Row: {
          id: number
          max_failure_rate: number
          max_user_signals_per_day: number
          min_age_days: number
          min_avg_confidence: number
          min_match_count: number
          min_matches_before_retire: number
          min_unique_users: number
          quarantine_exonerate_after: number
          signals_before_adjudication: number
          updated_at: string
        }
        Insert: {
          id?: number
          max_failure_rate?: number
          max_user_signals_per_day?: number
          min_age_days?: number
          min_avg_confidence?: number
          min_match_count?: number
          min_matches_before_retire?: number
          min_unique_users?: number
          quarantine_exonerate_after?: number
          signals_before_adjudication?: number
          updated_at?: string
        }
        Update: {
          id?: number
          max_failure_rate?: number
          max_user_signals_per_day?: number
          min_age_days?: number
          min_avg_confidence?: number
          min_match_count?: number
          min_matches_before_retire?: number
          min_unique_users?: number
          quarantine_exonerate_after?: number
          signals_before_adjudication?: number
          updated_at?: string
        }
        Relationships: []
      }
      sms_sender_currency: {
        Row: {
          confirmed: boolean
          currency: Database["public"]["Enums"]["currency_code"]
          hit_count: number
          sender: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          currency: Database["public"]["Enums"]["currency_code"]
          hit_count?: number
          sender: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed?: boolean
          currency?: Database["public"]["Enums"]["currency_code"]
          hit_count?: number
          sender?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_sender_pool: {
        Row: {
          hit_count: number
          last_seen: string
          sender: string
          txn_count: number
        }
        Insert: {
          hit_count?: number
          last_seen?: string
          sender: string
          txn_count?: number
        }
        Update: {
          hit_count?: number
          last_seen?: string
          sender?: string
          txn_count?: number
        }
        Relationships: []
      }
      sms_template_signals: {
        Row: {
          adjudicated_at: string | null
          created_at: string
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          signal_kind: string
          sms_log_id: string | null
          template_id: string | null
          user_id: string
          verdict: string | null
        }
        Insert: {
          adjudicated_at?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          signal_kind: string
          sms_log_id?: string | null
          template_id?: string | null
          user_id: string
          verdict?: string | null
        }
        Update: {
          adjudicated_at?: string | null
          created_at?: string
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          signal_kind?: string
          sms_log_id?: string | null
          template_id?: string | null
          user_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_template_signals_sms_log_id_fkey"
            columns: ["sms_log_id"]
            isOneToOne: false
            referencedRelation: "sms_parse_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_template_signals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_template_users: {
        Row: {
          created_at: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_template_users_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_tracking_templates_ai: {
        Row: {
          ai_enabled: boolean
          auto_promoted: boolean
          avg_ai_confidence: number | null
          created_at: string
          exported_at: string | null
          failure_count: number
          hard_fail: boolean
          id: string
          kind: string | null
          last_matched_at: string | null
          mapping_rules: Json
          match_count: number
          merged_into: string | null
          prev_tier: string | null
          promoted_at: string | null
          quarantined_at: string | null
          regex_pattern: string
          retired_at: string | null
          sender: string
          shadow_agreements: number
          status: string
          template_sample: string
          tier: string
          unique_user_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_enabled?: boolean
          auto_promoted?: boolean
          avg_ai_confidence?: number | null
          created_at?: string
          exported_at?: string | null
          failure_count?: number
          hard_fail?: boolean
          id?: string
          kind?: string | null
          last_matched_at?: string | null
          mapping_rules: Json
          match_count?: number
          merged_into?: string | null
          prev_tier?: string | null
          promoted_at?: string | null
          quarantined_at?: string | null
          regex_pattern: string
          retired_at?: string | null
          sender: string
          shadow_agreements?: number
          status?: string
          template_sample: string
          tier?: string
          unique_user_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_enabled?: boolean
          auto_promoted?: boolean
          avg_ai_confidence?: number | null
          created_at?: string
          exported_at?: string | null
          failure_count?: number
          hard_fail?: boolean
          id?: string
          kind?: string | null
          last_matched_at?: string | null
          mapping_rules?: Json
          match_count?: number
          merged_into?: string | null
          prev_tier?: string | null
          promoted_at?: string | null
          quarantined_at?: string | null
          regex_pattern?: string
          retired_at?: string | null
          sender?: string
          shadow_agreements?: number
          status?: string
          template_sample?: string
          tier?: string
          unique_user_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_tracking_templates_ai_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: Database["public"]["Enums"]["subscription_billing_cycle"]
          billing_day: number
          brand_key: string | null
          cancelled_at: string | null
          catalog_region: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          ends_on: string | null
          expense_category: Database["public"]["Enums"]["expense_category"]
          id: string
          linked_recurring_expense_id: string | null
          my_share: number | null
          name: string
          next_billing_date: string | null
          notes: string | null
          paused_at: string | null
          payment_method_id: string | null
          pending_amount: number | null
          pending_plan_from: string | null
          pending_plan_id: string | null
          plan_id: string | null
          plan_name: string | null
          price_history: Json
          reminder: boolean
          shared_with: string[] | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          tracking: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_cycle?: Database["public"]["Enums"]["subscription_billing_cycle"]
          billing_day?: number
          brand_key?: string | null
          cancelled_at?: string | null
          catalog_region?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          ends_on?: string | null
          expense_category?: Database["public"]["Enums"]["expense_category"]
          id?: string
          linked_recurring_expense_id?: string | null
          my_share?: number | null
          name: string
          next_billing_date?: string | null
          notes?: string | null
          paused_at?: string | null
          payment_method_id?: string | null
          pending_amount?: number | null
          pending_plan_from?: string | null
          pending_plan_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          price_history?: Json
          reminder?: boolean
          shared_with?: string[] | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tracking?: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["subscription_billing_cycle"]
          billing_day?: number
          brand_key?: string | null
          cancelled_at?: string | null
          catalog_region?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          ends_on?: string | null
          expense_category?: Database["public"]["Enums"]["expense_category"]
          id?: string
          linked_recurring_expense_id?: string | null
          my_share?: number | null
          name?: string
          next_billing_date?: string | null
          notes?: string | null
          paused_at?: string | null
          payment_method_id?: string | null
          pending_amount?: number | null
          pending_plan_from?: string | null
          pending_plan_id?: string | null
          plan_id?: string | null
          plan_name?: string | null
          price_history?: Json
          reminder?: boolean
          shared_with?: string[] | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tracking?: string
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_label: string | null
          author_staff_id: string | null
          author_type: string
          body: string
          created_at: string
          id: string
          internal: boolean
          ticket_id: string
        }
        Insert: {
          author_label?: string | null
          author_staff_id?: string | null
          author_type: string
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id: string
        }
        Update: {
          author_label?: string | null
          author_staff_id?: string | null
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_staff_id_fkey"
            columns: ["author_staff_id"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          category: string
          created_at: string
          first_response_at: string | null
          id: string
          number: number
          priority: string
          requester_email: string | null
          resolved_at: string | null
          source: string
          status: string
          subject: string
          tags: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          category?: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          number?: never
          priority?: string
          requester_email?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject: string
          tags?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          category?: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          number?: never
          priority?: string
          requester_email?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject?: string
          tags?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_id: string
          last_used_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          last_used_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          last_used_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          feature_overrides: Json
          granted_by: string | null
          limit_overrides: Json
          note: string | null
          plan_key: string
          source: string
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          feature_overrides?: Json
          granted_by?: string | null
          limit_overrides?: Json
          note?: string | null
          plan_key: string
          source?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          feature_overrides?: Json
          granted_by?: string | null
          limit_overrides?: Json
          note?: string | null
          plan_key?: string
          source?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlements_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_entitlements_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
      }
      user_settings: {
        Row: {
          privacy: Json
          ai_provider: string
          budget_entry_mode: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout: Database["public"]["Enums"]["dashboard_layout"]
          enable_ai: boolean
          goal_alerts: boolean
          goal_progress_alerts: boolean
          language: Database["public"]["Enums"]["locale_code"]
          month_start_day: number
          no_income_declared: boolean
          show_all_currencies_in_forms: boolean
          show_cents_in_dashboard: boolean
          show_secondary_currency: boolean
          sms_tracking_enabled: boolean
          sub_due_reminders: boolean
          sub_price_alerts: boolean
          theme: Database["public"]["Enums"]["theme_mode"]
          tutorial_current_step: string | null
          tutorials_completed: string[]
          two_factor_email_enabled: boolean
          updated_at: string
          user_id: string
          wealth_gold_strip: string
        }
        Insert: {
          privacy?: Json
          ai_provider?: string
          budget_entry_mode?: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout?: Database["public"]["Enums"]["dashboard_layout"]
          enable_ai?: boolean
          goal_alerts?: boolean
          goal_progress_alerts?: boolean
          language?: Database["public"]["Enums"]["locale_code"]
          month_start_day?: number
          no_income_declared?: boolean
          show_all_currencies_in_forms?: boolean
          show_cents_in_dashboard?: boolean
          show_secondary_currency?: boolean
          sms_tracking_enabled?: boolean
          sub_due_reminders?: boolean
          sub_price_alerts?: boolean
          theme?: Database["public"]["Enums"]["theme_mode"]
          tutorial_current_step?: string | null
          tutorials_completed?: string[]
          two_factor_email_enabled?: boolean
          updated_at?: string
          user_id: string
          wealth_gold_strip?: string
        }
        Update: {
          privacy?: Json
          ai_provider?: string
          budget_entry_mode?: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout?: Database["public"]["Enums"]["dashboard_layout"]
          enable_ai?: boolean
          goal_alerts?: boolean
          goal_progress_alerts?: boolean
          language?: Database["public"]["Enums"]["locale_code"]
          month_start_day?: number
          no_income_declared?: boolean
          show_all_currencies_in_forms?: boolean
          show_cents_in_dashboard?: boolean
          show_secondary_currency?: boolean
          sms_tracking_enabled?: boolean
          sub_due_reminders?: boolean
          sub_price_alerts?: boolean
          theme?: Database["public"]["Enums"]["theme_mode"]
          tutorial_current_step?: string | null
          tutorials_completed?: string[]
          two_factor_email_enabled?: boolean
          updated_at?: string
          user_id?: string
          wealth_gold_strip?: string
        }
        Relationships: []
      }
    }
    Views: {
      sms_parse_today: {
        Row: {
          parsed_count_today: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_pocket_balance: {
        Args: { p_user: string; p_pocket: string; p_delta: number; p_kind: Database["public"]["Enums"]["savings_transaction_kind"]; p_group?: string; p_payment_method?: string; p_date?: string; p_note?: string; p_source?: string }
        Returns: number
      }
      latest_balance_reports: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["account_balance_reports"]["Row"][]
      }
      notification_candidate_users: { Args: never; Returns: string[] }
      publish_email_template: { Args: { p_key: string; p_locale: string; p_staff: string }; Returns: number }
      admin_entitlement_counts: { Args: never; Returns: { plan_key: string; status: string; n: number }[] }
      admin_loyalty_summary: { Args: never; Returns: Json }
      admin_ticket_counts: { Args: never; Returns: { status: string; priority: string; assignee_id: string | null; n: number }[] }
      admin_push_platform_counts: { Args: never; Returns: { platform: string; n: number }[] }
      admin_email_status_counts: {
        Args: { p_template?: string; p_locale?: string; p_from?: string; p_to?: string; p_q?: string }
        Returns: { status: string; n: number }[]
      }
      sync_pull: { Args: { p_since?: string }; Returns: Json }
      sync_table_delta: { Args: { p_table: string; p_win: string }; Returns: Json }
      analytics_touch: {
        Args: { p_seconds?: number; p_sessions?: number; p_paths?: Json }
        Returns: undefined
      }
      admin_refresh_metrics: { Args: never; Returns: undefined }
      add_debt_payment_with_expense: {
        Args: { p_expense: Json; p_payment: Json }
        Returns: Json
      }
      add_income_with_debt: {
        Args: { p_debt: Json; p_income: Json }
        Returns: Json
      }
      add_subscription_with_recurring_expense: {
        Args: { p_recurring_expense: Json; p_subscription: Json }
        Returns: Json
      }
      admin_activity_series: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          day: string
          sessions: number
        }[]
      }
      admin_feature_adoption: { Args: never; Returns: Json }
      admin_overview: { Args: never; Returns: Json }
      admin_rate_hit: {
        Args: { p_key: string; p_max_hits: number; p_window_seconds: number }
        Returns: boolean
      }
      admin_retention: { Args: { p_weeks?: number }; Returns: Json }
      admin_signup_series: {
        Args: { p_days?: number }
        Returns: {
          day: string
          signups: number
        }[]
      }
      admin_sms_health: { Args: { p_days?: number }; Returns: Json }
      admin_user_directory: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_order?: string
          p_plan?: string
          p_search?: string
          p_state?: string
        }
        Returns: Json
      }
      admin_user_overview: { Args: { p_user: string }; Returns: Json }
      ai_default_limits: { Args: never; Returns: Json }
      ai_effective_limits: { Args: { p_user: string }; Returns: Json }
      housekeeping: { Args: { p_analytics_days?: number }; Returns: Json }
      ai_quota_status: { Args: { p_user: string }; Returns: Json }
      ai_quota_release: {
        Args: { p_reservation: string; p_user: string }
        Returns: undefined
      }
      ai_quota_reserve: {
        Args: {
          p_chat: string
          p_est: number
          p_feature: string
          p_user: string
        }
        Returns: Json
      }
      ai_quota_settle: {
        Args: {
          p_cached: number
          p_in: number
          p_latency: number
          p_model: string
          p_out: number
          p_reservation: string
          p_status: string
          p_tier: string
          p_units: number
          p_user: string
        }
        Returns: undefined
      }
      ai_tmp_probe: { Args: never; Returns: undefined }
      api_rate_hit: {
        Args: { p_key: string; p_max_hits: number; p_window_seconds: number }
        Returns: boolean
      }
      bump_sms_keyword: {
        Args: { p_keyword: string; p_lang: string }
        Returns: undefined
      }
      bump_sms_sender: {
        Args: { p_is_txn: boolean; p_sender: string }
        Returns: undefined
      }
      bump_sms_template_failure: {
        Args: { p_hard?: boolean; p_reason?: string; p_template_id: string }
        Returns: string
      }
      cancel_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      check_email_status: { Args: { p_email: string }; Returns: Json }
      check_sms_promotion_eligibility: {
        Args: never
        Returns: {
          age_days: number
          avg_ai_confidence: number
          failure_rate: number
          match_count: number
          sender: string
          template_id: string
          unique_user_count: number
        }[]
      }
      cleanup_abandoned_anon_users: { Args: never; Returns: number }
      cleanup_expired_trusted_devices: { Args: never; Returns: number }
      correct_savings_balance: {
        Args: {
          p_account_id: string
          p_new_balance: number
          p_notes?: string
          p_transaction_id?: string
        }
        Returns: string
      }
      deposit_to_savings: {
        Args: {
          p_account_id: string
          p_amount: number
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_date?: string
          p_notes?: string
          p_transaction_id?: string
        }
        Returns: string
      }
      detect_zero_variance_templates: {
        Args: { p_min_matches?: number }
        Returns: {
          amount: number
          distinct_bodies: number
          template_id: string
        }[]
      }
      get_sms_keyword_pool: {
        Args: { top_n?: number }
        Returns: {
          hit_count: number
          keyword: string
          lang: string
        }[]
      }
      increment_sms_template_match_count: {
        Args: { p_id: string }
        Returns: undefined
      }
      learn_sms_sender_currency: {
        Args: {
          p_confirmed: boolean
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_sender: string
          p_user: string
        }
        Returns: undefined
      }
      reactivate_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      record_sms_template_shadow: {
        Args: { p_agreed: boolean; p_template_id: string }
        Returns: string
      }
      sms_mark_acked: {
        Args: { p_log_id: string; p_user_id: string }
        Returns: undefined
      }
      sms_mark_pushed: {
        Args: { p_delivered: boolean; p_log_id: string; p_result: Json }
        Returns: undefined
      }
      sms_templates_awaiting_adjudication: {
        Args: { p_undo_grace_seconds?: number }
        Returns: {
          pending: number
          template_id: string
        }[]
      }
      sms_try_pair: {
        Args: {
          p_amount: number
          p_amount_tolerance?: number
          p_log_id: string
          p_match_kinds: string[]
          p_received_at: string
          p_reference?: string
          p_require_equal_amount: boolean
          p_require_registered_sibling?: boolean
          p_self_kind?: string
          p_user_id: string
          p_window_seconds: number
        }
        Returns: {
          sibling_expense_id: string
          sibling_id: string
          sibling_income_id: string
          sibling_kind: string
          sibling_status: string
        }[]
      }
      stable_uuid: {
        Args: { p_legacy: string; p_user_id: string }
        Returns: string
      }
      update_subscription_and_re: {
        Args: {
          p_recurring_expense_updates: Json
          p_subscription_id: string
          p_subscription_updates: Json
        }
        Returns: undefined
      }
      upsert_merchant_category: {
        Args: {
          p_category: Database["public"]["Enums"]["expense_category"]
          p_key: string
          p_sample: string
          p_source: string
        }
        Returns: undefined
      }
      withdraw_from_savings: {
        Args: {
          p_account_id: string
          p_amount: number
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_date?: string
          p_notes?: string
          p_transaction_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      budget_entry_mode: "amount" | "percent_of_income"
      budget_household: "solo" | "partner" | "family"
      currency_code:
        | "AED"
        | "USD"
        | "EGP"
        | "EUR"
        | "GBP"
        | "SAR"
        | "KWD"
        | "QAR"
        | "BHD"
        | "OMR"
        | "MAD"
        | "TND"
        | "JOD"
        | "XAU"
        | "USDT"
        | "USDC"
        | "BTC"
        | "ETH"
      dashboard_layout: "standard" | "minimal"
      debt_direction: "i_owe" | "they_owe"
      debt_kind:
        | "personal"
        | "installment"
        | "credit_card"
        | "mortgage"
        | "loan"
        | "other"
      debt_received_via: "cash" | "bank_transfer" | "card" | "gold" | "other"
      expense_category:
        | "Rent"
        | "Transport"
        | "Food"
        | "Enjoyment"
        | "Savings"
        | "Debt"
        | "Remittance"
        | "Other"
        | "Groceries"
        | "Fuel"
        | "Health"
        | "Shopping"
        | "Education"
        | "Utilities"
        | "Subscription"
        | "ATM Cash Withdrawal"
        | "Transfer"
        | "Currency Exchange"
        | "CC Payoff"
        | "Top up"
        | "Installment"
        | "Instapay"
      goal_category:
        | "spending_control"
        | "emergency"
        | "vacation"
        | "home"
        | "car"
        | "education"
        | "wedding"
        | "retirement"
        | "other"
        | "phone_device"
        | "family_support"
        | "sadaqah_charity"
        | "gift"
        | "investment"
        | "debt_freedom"
        | "quality_of_life"
        | "business"
      goal_status: "active" | "paused" | "achieved"
      gold_karat: "18" | "21" | "22" | "24"
      income_event_status:
        | "confirmed"
        | "projected"
        | "late"
        | "missed"
        | "partial"
      income_source_type:
        | "salary"
        | "freelance"
        | "business"
        | "rental"
        | "investment"
        | "debt"
        | "gift"
        | "refund"
        | "other"
        | "bonus"
        | "savings"
      installment_provider:
        | "tabby"
        | "tamara"
        | "credit_card"
        | "postpay"
        | "other"
      locale_code: "en" | "ar"
      notification_type: "info" | "warning" | "success" | "error"
      payment_method_type:
        | "cash"
        | "bank_account"
        | "debit_card"
        | "credit_card"
        | "prepaid_card"
        | "other"
        | "wallet"
        | "bnpl"
      recurring_frequency:
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
        | "annually"
      savings_category: "savings" | "investment"
      savings_transaction_kind:
        | "deposit"
        | "withdraw"
        | "correct"
        | "withdrawal"
      savings_type:
        | "bank"
        | "cash"
        | "gold"
        | "crypto"
        | "stock"
        | "bond"
        | "real_estate"
        | "other"
        | "stablecoin"
        | "vault"
      subscription_billing_cycle:
        | "weekly"
        | "monthly"
        | "quarterly"
        | "yearly"
        | "semiannual"
      subscription_status: "active" | "paused" | "cancelled" | "trial"
      theme_mode: "dark" | "light"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      budget_entry_mode: ["amount", "percent_of_income"],
      budget_household: ["solo", "partner", "family"],
      currency_code: [
        "AED",
        "USD",
        "EGP",
        "EUR",
        "GBP",
        "SAR",
        "KWD",
        "QAR",
        "BHD",
        "OMR",
        "MAD",
        "TND",
        "JOD",
        "XAU",
        "USDT",
        "USDC",
        "BTC",
        "ETH",
      ],
      dashboard_layout: ["standard", "minimal"],
      debt_direction: ["i_owe", "they_owe"],
      debt_kind: [
        "personal",
        "installment",
        "credit_card",
        "mortgage",
        "loan",
        "other",
      ],
      debt_received_via: ["cash", "bank_transfer", "card", "gold", "other"],
      expense_category: [
        "Rent",
        "Transport",
        "Food",
        "Enjoyment",
        "Savings",
        "Debt",
        "Remittance",
        "Other",
        "Groceries",
        "Fuel",
        "Health",
        "Shopping",
        "Education",
        "Utilities",
        "Subscription",
        "ATM Cash Withdrawal",
        "Transfer",
        "Currency Exchange",
        "CC Payoff",
        "Top up",
        "Installment",
        "Instapay",
      ],
      goal_category: [
        "spending_control",
        "emergency",
        "vacation",
        "home",
        "car",
        "education",
        "wedding",
        "retirement",
        "other",
        "phone_device",
        "family_support",
        "sadaqah_charity",
        "gift",
        "investment",
        "debt_freedom",
        "quality_of_life",
        "business",
      ],
      goal_status: ["active", "paused", "achieved"],
      gold_karat: ["18", "21", "22", "24"],
      income_event_status: [
        "confirmed",
        "projected",
        "late",
        "missed",
        "partial",
      ],
      income_source_type: [
        "salary",
        "freelance",
        "business",
        "rental",
        "investment",
        "debt",
        "gift",
        "refund",
        "other",
        "bonus",
        "savings",
      ],
      installment_provider: [
        "tabby",
        "tamara",
        "credit_card",
        "postpay",
        "other",
      ],
      locale_code: ["en", "ar"],
      notification_type: ["info", "warning", "success", "error"],
      payment_method_type: [
        "cash",
        "bank_account",
        "debit_card",
        "credit_card",
        "prepaid_card",
        "other",
        "wallet",
        "bnpl",
      ],
      recurring_frequency: [
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "annually",
      ],
      savings_category: ["savings", "investment"],
      savings_transaction_kind: [
        "deposit",
        "withdraw",
        "correct",
        "withdrawal",
      ],
      savings_type: [
        "bank",
        "cash",
        "gold",
        "crypto",
        "stock",
        "bond",
        "real_estate",
        "other",
        "stablecoin",
        "vault",
      ],
      subscription_billing_cycle: [
        "weekly",
        "monthly",
        "quarterly",
        "yearly",
        "semiannual",
      ],
      subscription_status: ["active", "paused", "cancelled", "trial"],
      theme_mode: ["dark", "light"],
    },
  },
} as const
