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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_adjustments: {
        Row: {
          anchor_balance: number | null
          created_at: string
          deleted_at: string | null
          delta: number
          edited_at: string
          id: string
          note: string | null
          occurred_at: string
          payment_method_id: string
          reason: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_balance?: number | null
          created_at?: string
          deleted_at?: string | null
          delta: number
          edited_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          payment_method_id: string
          reason: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_balance?: number | null
          created_at?: string
          deleted_at?: string | null
          delta?: number
          edited_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          payment_method_id?: string
          reason?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_adjustments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      account_balance_reports: {
        Row: {
          balance: number
          created_at: string
          currency: string | null
          id: string
          payment_method_id: string
          reported_at: string
          sms_parse_log_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          balance: number
          created_at?: string
          currency?: string | null
          id?: string
          payment_method_id: string
          reported_at: string
          sms_parse_log_id?: string | null
          source?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string | null
          id?: string
          payment_method_id?: string
          reported_at?: string
          sms_parse_log_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balance_reports_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_balance_reports_sms_parse_log_id_fkey"
            columns: ["sms_parse_log_id"]
            isOneToOne: false
            referencedRelation: "sms_parse_log"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_grants: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          denied_at: string | null
          expires_at: string | null
          extended: boolean
          id: string
          mode: string
          note: string | null
          reason: string
          requested_at: string
          revoked_at: string | null
          scope: string
          staff_id: string
          target_user_id: string
          ticket_number: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          denied_at?: string | null
          expires_at?: string | null
          extended?: boolean
          id?: string
          mode?: string
          note?: string | null
          reason: string
          requested_at?: string
          revoked_at?: string | null
          scope: string
          staff_id: string
          target_user_id: string
          ticket_number?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          denied_at?: string | null
          expires_at?: string | null
          extended?: boolean
          id?: string
          mode?: string
          note?: string | null
          reason?: string
          requested_at?: string
          revoked_at?: string | null
          scope?: string
          staff_id?: string
          target_user_id?: string
          ticket_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_grants_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_grants_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
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
      admin_financial_exclusions: {
        Row: {
          created_at: string
          excluded_by: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          excluded_by?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          excluded_by?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_financial_exclusions_excluded_by_fkey"
            columns: ["excluded_by"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_metrics_cache: {
        Row: {
          computed_at: string
          key: string
          value: Json
        }
        Insert: {
          computed_at?: string
          key: string
          value: Json
        }
        Update: {
          computed_at?: string
          key?: string
          value?: Json
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
      advisor_free_uses: {
        Row: {
          id: number
          used_at: string
          user_id: string
        }
        Insert: {
          id?: never
          used_at?: string
          user_id: string
        }
        Update: {
          id?: never
          used_at?: string
          user_id?: string
        }
        Relationships: []
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
      ai_credit_resets: {
        Row: {
          created_at: string
          granted_by: string | null
          id: number
          reason: string | null
          scope: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: never
          reason?: string | null
          scope: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: never
          reason?: string | null
          scope?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_credit_sessions: {
        Row: {
          session_start: string
          user_id: string
        }
        Insert: {
          session_start: string
          user_id: string
        }
        Update: {
          session_start?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_model_alerts: {
        Row: {
          alert_date: string
          calls: number
          created_at: string
          empties: number
          errors: number
          failed_share: number
          id: number
          model: string
          rule: string
          thresholds: Json
        }
        Insert: {
          alert_date: string
          calls: number
          created_at?: string
          empties: number
          errors: number
          failed_share: number
          id?: never
          model: string
          rule: string
          thresholds: Json
        }
        Update: {
          alert_date?: string
          calls?: number
          created_at?: string
          empties?: number
          errors?: number
          failed_share?: number
          id?: never
          model?: string
          rule?: string
          thresholds?: Json
        }
        Relationships: []
      }
      ai_price_book: {
        Row: {
          audio_usd_per_min: number | null
          cached_usd_per_mtok: number
          created_at: string
          effective_from: string
          effective_to: string | null
          id: number
          in_usd_per_mtok: number
          model: string
          out_usd_per_mtok: number
          provider: string
          source_note: string | null
        }
        Insert: {
          audio_usd_per_min?: number | null
          cached_usd_per_mtok?: number
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: never
          in_usd_per_mtok?: number
          model: string
          out_usd_per_mtok?: number
          provider: string
          source_note?: string | null
        }
        Update: {
          audio_usd_per_min?: number | null
          cached_usd_per_mtok?: number
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: never
          in_usd_per_mtok?: number
          model?: string
          out_usd_per_mtok?: number
          provider?: string
          source_note?: string | null
        }
        Relationships: []
      }
      ai_reservations: {
        Row: {
          advisor_free: boolean
          chat_id: string | null
          created_at: string
          est_units: number
          expires_at: string
          feature: string
          free_rerun: boolean
          id: string
          settled: boolean
          sparks: number
          turn_id: string | null
          use_sparks: boolean
          user_id: string
        }
        Insert: {
          advisor_free?: boolean
          chat_id?: string | null
          created_at?: string
          est_units?: number
          expires_at: string
          feature: string
          free_rerun?: boolean
          id?: string
          settled?: boolean
          sparks?: number
          turn_id?: string | null
          use_sparks?: boolean
          user_id: string
        }
        Update: {
          advisor_free?: boolean
          chat_id?: string | null
          created_at?: string
          est_units?: number
          expires_at?: string
          feature?: string
          free_rerun?: boolean
          id?: string
          settled?: boolean
          sparks?: number
          turn_id?: string | null
          use_sparks?: boolean
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
      ai_turns: {
        Row: {
          chat_id: string | null
          closed_at: string | null
          created_at: string
          rerun_open: boolean
          rerun_seen: boolean
          reruns: number
          spark_cost_micro: number
          state: string
          turn_id: string
          use_sparks: boolean
          user_id: string
          visible: boolean
        }
        Insert: {
          chat_id?: string | null
          closed_at?: string | null
          created_at?: string
          rerun_open?: boolean
          rerun_seen?: boolean
          reruns?: number
          spark_cost_micro?: number
          state?: string
          turn_id: string
          use_sparks?: boolean
          user_id: string
          visible?: boolean
        }
        Update: {
          chat_id?: string | null
          closed_at?: string | null
          created_at?: string
          rerun_open?: boolean
          rerun_seen?: boolean
          reruns?: number
          spark_cost_micro?: number
          state?: string
          turn_id?: string
          use_sparks?: boolean
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          cached_tokens: number
          calls: number
          day: string
          failed_calls: number
          feature: string
          in_tokens: number
          latency_ms_total: number
          model: string
          out_tokens: number
          units: number
          user_id: string
        }
        Insert: {
          cached_tokens?: number
          calls?: number
          day: string
          failed_calls?: number
          feature: string
          in_tokens?: number
          latency_ms_total?: number
          model: string
          out_tokens?: number
          units?: number
          user_id: string
        }
        Update: {
          cached_tokens?: number
          calls?: number
          day?: string
          failed_calls?: number
          feature?: string
          in_tokens?: number
          latency_ms_total?: number
          model?: string
          out_tokens?: number
          units?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          cached_tokens: number
          chat_id: string | null
          cost_usd_micro: number | null
          created_at: string
          credits_exempt: boolean
          feature: string
          id: number
          in_tokens: number
          latency_ms: number | null
          model: string | null
          out_tokens: number
          status: string
          tier: string | null
          turn_id: string | null
          units: number
          user_id: string
        }
        Insert: {
          cached_tokens?: number
          chat_id?: string | null
          cost_usd_micro?: number | null
          created_at?: string
          credits_exempt?: boolean
          feature: string
          id?: never
          in_tokens?: number
          latency_ms?: number | null
          model?: string | null
          out_tokens?: number
          status?: string
          tier?: string | null
          turn_id?: string | null
          units?: number
          user_id: string
        }
        Update: {
          cached_tokens?: number
          chat_id?: string | null
          cost_usd_micro?: number | null
          created_at?: string
          credits_exempt?: boolean
          feature?: string
          id?: never
          in_tokens?: number
          latency_ms?: number | null
          model?: string | null
          out_tokens?: number
          status?: string
          tier?: string | null
          turn_id?: string | null
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
      balance_views: {
        Row: {
          id: number
          payment_method_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: never
          payment_method_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: never
          payment_method_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      beta_testers: {
        Row: {
          granted_at: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          currency: string | null
          event_at: string
          event_id: string
          id: number
          outcome: string
          price_micros: number | null
          product_id: string | null
          provider: string
          received_at: string
          store: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          currency?: string | null
          event_at: string
          event_id: string
          id?: never
          outcome?: string
          price_micros?: number | null
          product_id?: string | null
          provider: string
          received_at?: string
          store?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          currency?: string | null
          event_at?: string
          event_id?: string
          id?: never
          outcome?: string
          price_micros?: number | null
          product_id?: string | null
          provider?: string
          received_at?: string
          store?: string | null
          type?: string
          user_id?: string | null
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
          edited_at: string
          id: string
          kind: string
          plan_id: string | null
          source: string
          status: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          id?: string
          kind?: string
          plan_id?: string | null
          source?: string
          status?: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          id?: string
          kind?: string
          plan_id?: string | null
          source?: string
          status?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddgy_memories_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "budget_plans"
            referencedColumns: ["id"]
          },
        ]
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
          edited_at: string
          effective_from: string
          id: string
          plan_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          effective_from: string
          id?: string
          plan_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          edited_at?: string
          effective_from?: string
          id?: string
          plan_id?: string
          updated_at?: string
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
      client_crash_events: {
        Row: {
          crash_id: string
          event_id: string
        }
        Insert: {
          crash_id: string
          event_id: string
        }
        Update: {
          crash_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_crash_events_crash_id_fkey"
            columns: ["crash_id"]
            isOneToOne: false
            referencedRelation: "client_crashes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_crashes: {
        Row: {
          build: string | null
          culprit: string | null
          device_id: string | null
          fingerprint: string
          first_seen: string
          id: string
          last_seen: string
          level: string
          occurrences: number
          platform: string | null
          release: string
          resolved_at: string | null
          resolved_build: string | null
          sentry_issue_id: string | null
          sentry_url: string | null
          stack: string | null
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          build?: string | null
          culprit?: string | null
          device_id?: string | null
          fingerprint: string
          first_seen?: string
          id?: string
          last_seen?: string
          level?: string
          occurrences?: number
          platform?: string | null
          release?: string
          resolved_at?: string | null
          resolved_build?: string | null
          sentry_issue_id?: string | null
          sentry_url?: string | null
          stack?: string | null
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          build?: string | null
          culprit?: string | null
          device_id?: string | null
          fingerprint?: string
          first_seen?: string
          id?: string
          last_seen?: string
          level?: string
          occurrences?: number
          platform?: string | null
          release?: string
          resolved_at?: string | null
          resolved_build?: string | null
          sentry_issue_id?: string | null
          sentry_url?: string | null
          stack?: string | null
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coming_soon_interest: {
        Row: {
          created_at: string
          feature: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          amount_in_base: number | null
          amount_in_debt_unit: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          debt_id: string
          deleted_at: string | null
          edited_at: string
          funded_from_savings: boolean
          funded_from_savings_tx_id: string | null
          id: string
          notes: string | null
          occurred_at: string | null
          original_amount: number | null
          original_currency: Database["public"]["Enums"]["currency_code"] | null
          payment_date: string
          payment_method_id: string | null
          rate_at_entry: number | null
          sms_log_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_in_base?: number | null
          amount_in_debt_unit?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_id: string
          deleted_at?: string | null
          edited_at?: string
          funded_from_savings?: boolean
          funded_from_savings_tx_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string | null
          original_amount?: number | null
          original_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          payment_date?: string
          payment_method_id?: string | null
          rate_at_entry?: number | null
          sms_log_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_in_base?: number | null
          amount_in_debt_unit?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_id?: string
          deleted_at?: string | null
          edited_at?: string
          funded_from_savings?: boolean
          funded_from_savings_tx_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string | null
          original_amount?: number | null
          original_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          payment_date?: string
          payment_method_id?: string | null
          rate_at_entry?: number | null
          sms_log_id?: string | null
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
          default_payment_method_id: string | null
          deleted_at: string | null
          description: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          edited_at: string
          emoji: string | null
          goal: Json | null
          gold_karat: Database["public"]["Enums"]["gold_karat"] | null
          grace_period_days: number | null
          id: string
          installment_amount: number | null
          installment_count: number | null
          installment_frequency:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_icon: string | null
          installment_item_name: string | null
          installment_item_type: string | null
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
          principal_amount: number | null
          principal_at: string | null
          principal_currency:
            | Database["public"]["Enums"]["currency_code"]
            | null
          principal_payment_method_id: string | null
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
          default_payment_method_id?: string | null
          deleted_at?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          edited_at?: string
          emoji?: string | null
          goal?: Json | null
          gold_karat?: Database["public"]["Enums"]["gold_karat"] | null
          grace_period_days?: number | null
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          installment_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_icon?: string | null
          installment_item_name?: string | null
          installment_item_type?: string | null
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
          principal_amount?: number | null
          principal_at?: string | null
          principal_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          principal_payment_method_id?: string | null
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
          default_payment_method_id?: string | null
          deleted_at?: string | null
          description?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          edited_at?: string
          emoji?: string | null
          goal?: Json | null
          gold_karat?: Database["public"]["Enums"]["gold_karat"] | null
          grace_period_days?: number | null
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          installment_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_icon?: string | null
          installment_item_name?: string | null
          installment_item_type?: string | null
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
          principal_amount?: number | null
          principal_at?: string | null
          principal_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          principal_payment_method_id?: string | null
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
            foreignKeyName: "debts_default_payment_method_id_fkey"
            columns: ["default_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "debts_principal_payment_method_id_fkey"
            columns: ["principal_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          is_test: boolean
          latency_ms: number | null
          locale: string
          provider_message_id: string | null
          source: string
          status: string
          template_key: string
          to_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          is_test?: boolean
          latency_ms?: number | null
          locale: string
          provider_message_id?: string | null
          source: string
          status: string
          template_key: string
          to_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          is_test?: boolean
          latency_ms?: number | null
          locale?: string
          provider_message_id?: string | null
          source?: string
          status?: string
          template_key?: string
          to_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          reason?: string
        }
        Relationships: []
      }
      email_template_versions: {
        Row: {
          blocks: Json
          html: string
          id: string
          key: string
          locale: string
          mode: string
          preheader: string
          published_at: string
          published_by: string | null
          subject: string
          version: number
        }
        Insert: {
          blocks?: Json
          html: string
          id?: string
          key: string
          locale: string
          mode: string
          preheader?: string
          published_at?: string
          published_by?: string | null
          subject: string
          version: number
        }
        Update: {
          blocks?: Json
          html?: string
          id?: string
          key?: string
          locale?: string
          mode?: string
          preheader?: string
          published_at?: string
          published_by?: string | null
          subject?: string
          version?: number
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          blocks: Json
          html: string
          id: string
          key: string
          locale: string
          mode: string
          preheader: string
          status: string
          subject: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          blocks?: Json
          html: string
          id?: string
          key: string
          locale: string
          mode?: string
          preheader?: string
          status: string
          subject: string
          updated_at?: string
          updated_by?: string | null
          version: number
        }
        Update: {
          blocks?: Json
          html?: string
          id?: string
          key?: string
          locale?: string
          mode?: string
          preheader?: string
          status?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_amount: number | null
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          category_label: string | null
          category_source: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          description: string | null
          edited_at: string
          expense_date: string
          funded_from_savings_tx_id: string | null
          id: string
          is_debt_payment: boolean
          is_recurring: boolean
          linked_debt_id: string | null
          linked_debt_payment_id: string | null
          linked_subscription_id: string | null
          notes: string | null
          occurred_at: string | null
          owed_by: string | null
          owed_settled_at: string | null
          payment_method_id: string | null
          receipt_id: string | null
          refund_kind: string | null
          refund_sms_log_id: string | null
          refunded_amount: number | null
          refunded_at: string | null
          retracted_by_sms_log_id: string | null
          server_rev: number | null
          shared_plan_id: string | null
          sms_flags: string[] | null
          sms_flags_ack: string[] | null
          sms_log_id: string | null
          spend_exclusion: string | null
          subcategory: string | null
          to_account_amount: number | null
          to_payment_method_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_amount?: number | null
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          category_label?: string | null
          category_source?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          description?: string | null
          edited_at?: string
          expense_date?: string
          funded_from_savings_tx_id?: string | null
          id?: string
          is_debt_payment?: boolean
          is_recurring?: boolean
          linked_debt_id?: string | null
          linked_debt_payment_id?: string | null
          linked_subscription_id?: string | null
          notes?: string | null
          occurred_at?: string | null
          owed_by?: string | null
          owed_settled_at?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          refund_kind?: string | null
          refund_sms_log_id?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          retracted_by_sms_log_id?: string | null
          server_rev?: number | null
          shared_plan_id?: string | null
          sms_flags?: string[] | null
          sms_flags_ack?: string[] | null
          sms_log_id?: string | null
          spend_exclusion?: string | null
          subcategory?: string | null
          to_account_amount?: number | null
          to_payment_method_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_amount?: number | null
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          category_label?: string | null
          category_source?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          description?: string | null
          edited_at?: string
          expense_date?: string
          funded_from_savings_tx_id?: string | null
          id?: string
          is_debt_payment?: boolean
          is_recurring?: boolean
          linked_debt_id?: string | null
          linked_debt_payment_id?: string | null
          linked_subscription_id?: string | null
          notes?: string | null
          occurred_at?: string | null
          owed_by?: string | null
          owed_settled_at?: string | null
          payment_method_id?: string | null
          receipt_id?: string | null
          refund_kind?: string | null
          refund_sms_log_id?: string | null
          refunded_amount?: number | null
          refunded_at?: string | null
          retracted_by_sms_log_id?: string | null
          server_rev?: number | null
          shared_plan_id?: string | null
          sms_flags?: string[] | null
          sms_flags_ack?: string[] | null
          sms_log_id?: string | null
          spend_exclusion?: string | null
          subcategory?: string | null
          to_account_amount?: number | null
          to_payment_method_id?: string | null
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
          {
            foreignKeyName: "expenses_to_payment_method_id_fkey"
            columns: ["to_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
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
      feedback_votes: {
        Row: {
          created_at: string
          ticket_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          ticket_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          ticket_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_votes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_candidates: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          proposed_at: string
          qualified_at: string
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          proposed_at?: string
          qualified_at: string
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          proposed_at?: string
          qualified_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founders: {
        Row: {
          cohort: string
          credit_name: string | null
          credit_name_requested: string | null
          credit_name_status: string
          granted_at: string
          number: number
          qualified_at: string
          retired_at: string | null
          retired_reason: string | null
          user_id: string | null
        }
        Insert: {
          cohort: string
          credit_name?: string | null
          credit_name_requested?: string | null
          credit_name_status?: string
          granted_at?: string
          number: number
          qualified_at: string
          retired_at?: string | null
          retired_reason?: string | null
          user_id?: string | null
        }
        Update: {
          cohort?: string
          credit_name?: string | null
          credit_name_requested?: string | null
          credit_name_status?: string
          granted_at?: string
          number?: number
          qualified_at?: string
          retired_at?: string | null
          retired_reason?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
          account_amount: number | null
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          edited_at: string
          exclusion: string | null
          id: string
          linked_debt_id: string | null
          linked_savings_account_id: string | null
          name: string
          notes: string | null
          occurred_at: string | null
          occurrence_date: string | null
          payment_method_id: string | null
          received_date: string
          retracted_by_sms_log_id: string | null
          server_rev: number | null
          shared_plan_id: string | null
          sms_flags: string[] | null
          sms_flags_ack: string[] | null
          sms_log_id: string | null
          source_type: Database["public"]["Enums"]["income_source_type"]
          status: Database["public"]["Enums"]["income_event_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_amount?: number | null
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          edited_at?: string
          exclusion?: string | null
          id?: string
          linked_debt_id?: string | null
          linked_savings_account_id?: string | null
          name: string
          notes?: string | null
          occurred_at?: string | null
          occurrence_date?: string | null
          payment_method_id?: string | null
          received_date: string
          retracted_by_sms_log_id?: string | null
          server_rev?: number | null
          shared_plan_id?: string | null
          sms_flags?: string[] | null
          sms_flags_ack?: string[] | null
          sms_log_id?: string | null
          source_type?: Database["public"]["Enums"]["income_source_type"]
          status?: Database["public"]["Enums"]["income_event_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_amount?: number | null
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          edited_at?: string
          exclusion?: string | null
          id?: string
          linked_debt_id?: string | null
          linked_savings_account_id?: string | null
          name?: string
          notes?: string | null
          occurred_at?: string | null
          occurrence_date?: string | null
          payment_method_id?: string | null
          received_date?: string
          retracted_by_sms_log_id?: string | null
          server_rev?: number | null
          shared_plan_id?: string | null
          sms_flags?: string[] | null
          sms_flags_ack?: string[] | null
          sms_log_id?: string | null
          source_type?: Database["public"]["Enums"]["income_source_type"]
          status?: Database["public"]["Enums"]["income_event_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_events_linked_debt_id_fkey"
            columns: ["linked_debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_events_linked_savings_account_id_fkey"
            columns: ["linked_savings_account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_events_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "income_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      income_sources: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          day_of_month: number | null
          deleted_at: string | null
          edited_at: string
          effective_end: string | null
          effective_start: string
          icon: string | null
          id: string
          is_irregular: boolean
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
          edited_at?: string
          effective_end?: string | null
          effective_start: string
          icon?: string | null
          id?: string
          is_irregular?: boolean
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
          edited_at?: string
          effective_end?: string | null
          effective_start?: string
          icon?: string | null
          id?: string
          is_irregular?: boolean
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
            foreignKeyName: "income_sources_linked_debt_id_fkey"
            columns: ["linked_debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_sources_linked_savings_account_id_fkey"
            columns: ["linked_savings_account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_sources_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          ticket_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          last_error?: string | null
          next_attempt_at?: string
          payload: Json
          sent_at?: string | null
          status?: string
          ticket_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_outbox_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
          buddgy_look: string
          card_finish: string
          freezes_banked: number
          gifted_rank: number
          kept_weeks_total: number
          last_kept_week: string | null
          lifetime_points: number
          multiplier_step: number
          points_balance: number
          streak_best: number
          streak_weeks: number
          tier_key: string | null
          tier_locked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          buddgy_look?: string
          card_finish?: string
          freezes_banked?: number
          gifted_rank?: number
          kept_weeks_total?: number
          last_kept_week?: string | null
          lifetime_points?: number
          multiplier_step?: number
          points_balance?: number
          streak_best?: number
          streak_weeks?: number
          tier_key?: string | null
          tier_locked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          buddgy_look?: string
          card_finish?: string
          freezes_banked?: number
          gifted_rank?: number
          kept_weeks_total?: number
          last_kept_week?: string | null
          lifetime_points?: number
          multiplier_step?: number
          points_balance?: number
          streak_best?: number
          streak_weeks?: number
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
      loyalty_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          meta: Json
          period_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          meta?: Json
          period_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          meta?: Json
          period_key?: string
          user_id?: string
        }
        Relationships: []
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
      loyalty_owned_items: {
        Row: {
          acquired_at: string
          item_key: string
          kind: string
          source: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          item_key: string
          kind: string
          source: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          item_key?: string
          kind?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_program: {
        Row: {
          founder_cap: number
          founder_window_closes: string
          founder_window_opens: string
          id: boolean
        }
        Insert: {
          founder_cap?: number
          founder_window_closes: string
          founder_window_opens: string
          id?: boolean
        }
        Update: {
          founder_cap?: number
          founder_window_closes?: string
          founder_window_opens?: string
          id?: boolean
        }
        Relationships: []
      }
      loyalty_seasonal_freezes: {
        Row: {
          ends_on: string
          id: number
          label: string
          starts_on: string
        }
        Insert: {
          ends_on: string
          id?: never
          label: string
          starts_on: string
        }
        Update: {
          ends_on?: string
          id?: never
          label?: string
          starts_on?: string
        }
        Relationships: []
      }
      loyalty_shop_items: {
        Row: {
          active: boolean
          cost: number
          item_key: string | null
          key: string
          kind: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          cost: number
          item_key?: string | null
          key: string
          kind: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          cost?: number
          item_key?: string | null
          key?: string
          kind?: string
          sort_order?: number
        }
        Relationships: []
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
          requires_founder: boolean
          requires_pro: boolean
          sort_order: number
          sparks_gift: number
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
          requires_founder?: boolean
          requires_pro?: boolean
          sort_order?: number
          sparks_gift?: number
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
          requires_founder?: boolean
          requires_pro?: boolean
          sort_order?: number
          sparks_gift?: number
          status?: string
        }
        Relationships: []
      }
      member_numbers: {
        Row: {
          created_at: string
          number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          number?: number
          user_id: string
        }
        Update: {
          created_at?: string
          number?: number
          user_id?: string
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
      merchant_category_overrides: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          merchant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["expense_category"]
          merchant_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          merchant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_category_votes: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          merchant_key: string
          user_id: string
          voted_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["expense_category"]
          merchant_key: string
          user_id: string
          voted_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          merchant_key?: string
          user_id?: string
          voted_at?: string
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
          card_style: string | null
          card_theme: string | null
          closed_at: string | null
          color: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          edited_at: string
          excluded: boolean
          id: string
          is_default: boolean
          is_savings: boolean
          label: string | null
          last4: string | null
          last4_aliases: string[]
          name: string
          notes: string | null
          opening_at: string | null
          opening_balance: number | null
          parent_id: string | null
          pays_from_payment_method_id: string | null
          provisional: boolean
          track_sms: boolean
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          card_style?: string | null
          card_theme?: string | null
          closed_at?: string | null
          color?: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          edited_at?: string
          excluded?: boolean
          id?: string
          is_default?: boolean
          is_savings?: boolean
          label?: string | null
          last4?: string | null
          last4_aliases?: string[]
          name: string
          notes?: string | null
          opening_at?: string | null
          opening_balance?: number | null
          parent_id?: string | null
          pays_from_payment_method_id?: string | null
          provisional?: boolean
          track_sms?: boolean
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          card_style?: string | null
          card_theme?: string | null
          closed_at?: string | null
          color?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          edited_at?: string
          excluded?: boolean
          id?: string
          is_default?: boolean
          is_savings?: boolean
          label?: string | null
          last4?: string | null
          last4_aliases?: string[]
          name?: string
          notes?: string | null
          opening_at?: string | null
          opening_balance?: number | null
          parent_id?: string | null
          pays_from_payment_method_id?: string | null
          provisional?: boolean
          track_sms?: boolean
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_pays_from_payment_method_id_fkey"
            columns: ["pays_from_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      paywall_views: {
        Row: {
          country: string | null
          id: number
          platform: string | null
          source: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          country?: string | null
          id?: never
          platform?: string | null
          source?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          country?: string | null
          id?: never
          platform?: string | null
          source?: string | null
          user_id?: string
          viewed_at?: string
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
          store_products: Json
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
          store_products?: Json
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
          store_products?: Json
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
      pro_promo_grants: {
        Row: {
          created_at: string
          days: number
          granted_by: string | null
          id: number
          referral_id: number | null
          revoked_at: string | null
          source: string
          started_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          days: number
          granted_by?: string | null
          id?: never
          referral_id?: number | null
          revoked_at?: string | null
          source: string
          started_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number
          granted_by?: string | null
          id?: never
          referral_id?: number | null
          revoked_at?: string | null
          source?: string
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_promo_grants_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_budget_plan_id: string | null
          active_shared_budget_id: string | null
          avatar_emoji: string | null
          avatar_image_path: string | null
          base_currency: Database["public"]["Enums"]["currency_code"]
          city: string | null
          country: string | null
          created_at: string
          data_reset_at: string | null
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
          savings_split: Json
          secondary_currency:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode: string | null
          updated_at: string
          welcome_email_sent_at: string | null
          zakat_config: Json
        }
        Insert: {
          active_budget_plan_id?: string | null
          active_shared_budget_id?: string | null
          avatar_emoji?: string | null
          avatar_image_path?: string | null
          base_currency?: Database["public"]["Enums"]["currency_code"]
          city?: string | null
          country?: string | null
          created_at?: string
          data_reset_at?: string | null
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
          savings_split?: Json
          secondary_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode?: string | null
          updated_at?: string
          welcome_email_sent_at?: string | null
          zakat_config?: Json
        }
        Update: {
          active_budget_plan_id?: string | null
          active_shared_budget_id?: string | null
          avatar_emoji?: string | null
          avatar_image_path?: string | null
          base_currency?: Database["public"]["Enums"]["currency_code"]
          city?: string | null
          country?: string | null
          created_at?: string
          data_reset_at?: string | null
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
          savings_split?: Json
          secondary_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode?: string | null
          updated_at?: string
          welcome_email_sent_at?: string | null
          zakat_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_budget_plan_id_fkey"
            columns: ["active_budget_plan_id"]
            isOneToOne: false
            referencedRelation: "budget_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_carry_pocket_id_fkey"
            columns: ["default_carry_pocket_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          app_version: string | null
          device_id: string | null
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
          device_id?: string | null
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
          device_id?: string | null
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
          due_day: number | null
          edited_at: string
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
          due_day?: number | null
          edited_at?: string
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
          due_day?: number | null
          edited_at?: string
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
      referral_codes: {
        Row: {
          activated_count: number
          code: string
          created_at: string
          invited_count: number
          owner_net: string | null
          rewards_count: number
          user_id: string
        }
        Insert: {
          activated_count?: number
          code: string
          created_at?: string
          invited_count?: number
          owner_net?: string | null
          rewards_count?: number
          user_id: string
        }
        Update: {
          activated_count?: number
          code?: string
          created_at?: string
          invited_count?: number
          owner_net?: string | null
          rewards_count?: number
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          activated_at: string | null
          active_days: number
          code: string
          created_at: string
          device_id: string | null
          ended_at: string | null
          id: number
          invitee_created_at: string
          invitee_id: string | null
          invitee_mailbox: string | null
          invitee_net: string | null
          inviter_id: string | null
          reason: string | null
          review_signals: string[] | null
          reward_kind: string | null
          rewarded_at: string | null
          status: string
          trial_bonus_applied: boolean
          tx_count: number
        }
        Insert: {
          activated_at?: string | null
          active_days?: number
          code: string
          created_at?: string
          device_id?: string | null
          ended_at?: string | null
          id?: never
          invitee_created_at: string
          invitee_id?: string | null
          invitee_mailbox?: string | null
          invitee_net?: string | null
          inviter_id?: string | null
          reason?: string | null
          review_signals?: string[] | null
          reward_kind?: string | null
          rewarded_at?: string | null
          status?: string
          trial_bonus_applied?: boolean
          tx_count?: number
        }
        Update: {
          activated_at?: string | null
          active_days?: number
          code?: string
          created_at?: string
          device_id?: string | null
          ended_at?: string | null
          id?: never
          invitee_created_at?: string
          invitee_id?: string | null
          invitee_mailbox?: string | null
          invitee_net?: string | null
          inviter_id?: string | null
          reason?: string | null
          review_signals?: string[] | null
          reward_kind?: string | null
          rewarded_at?: string | null
          status?: string
          trial_bonus_applied?: boolean
          tx_count?: number
        }
        Relationships: []
      }
      savings_accounts: {
        Row: {
          category: Database["public"]["Enums"]["savings_category"]
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_balance: number
          deleted_at: string | null
          edited_at: string
          emoji: string | null
          goal_id: string | null
          held_in_payment_method_id: string | null
          icon: string | null
          id: string
          is_emergency_cover: boolean
          is_monthly_savings: boolean
          linked_payment_method_id: string | null
          metadata: Json
          name: string
          notes: string | null
          opening_balance: number
          target_amount: number | null
          type: Database["public"]["Enums"]["savings_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["savings_category"]
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          deleted_at?: string | null
          edited_at?: string
          emoji?: string | null
          goal_id?: string | null
          held_in_payment_method_id?: string | null
          icon?: string | null
          id?: string
          is_emergency_cover?: boolean
          is_monthly_savings?: boolean
          linked_payment_method_id?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          opening_balance?: number
          target_amount?: number | null
          type?: Database["public"]["Enums"]["savings_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["savings_category"]
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          deleted_at?: string | null
          edited_at?: string
          emoji?: string | null
          goal_id?: string | null
          held_in_payment_method_id?: string | null
          icon?: string | null
          id?: string
          is_emergency_cover?: boolean
          is_monthly_savings?: boolean
          linked_payment_method_id?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          opening_balance?: number
          target_amount?: number | null
          type?: Database["public"]["Enums"]["savings_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_accounts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_accounts_held_in_payment_method_id_fkey"
            columns: ["held_in_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_accounts_linked_payment_method_id_fkey"
            columns: ["linked_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
          achieved_by_proposal: string[]
          allocated: number
          applied_at: string | null
          applied_by: string | null
          applied_lines: Json | null
          auto_apply_at: string | null
          capped: Json | null
          carry: number
          carry_adjustment: number
          carry_settled_at: string | null
          closed_at: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          cycle_end: string | null
          cycle_start: string | null
          figures: Json | null
          held_snapshot: Json | null
          id: string
          lines: Json | null
          month_key: string
          pocket_id: string | null
          rates: Json | null
          rates_apply: Json | null
          saved: number
          status: string
          target: number
          undone_at: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          achieved_by_proposal?: string[]
          allocated?: number
          applied_at?: string | null
          applied_by?: string | null
          applied_lines?: Json | null
          auto_apply_at?: string | null
          capped?: Json | null
          carry?: number
          carry_adjustment?: number
          carry_settled_at?: string | null
          closed_at?: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          cycle_end?: string | null
          cycle_start?: string | null
          figures?: Json | null
          held_snapshot?: Json | null
          id?: string
          lines?: Json | null
          month_key: string
          pocket_id?: string | null
          rates?: Json | null
          rates_apply?: Json | null
          saved?: number
          status?: string
          target?: number
          undone_at?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          achieved_by_proposal?: string[]
          allocated?: number
          applied_at?: string | null
          applied_by?: string | null
          applied_lines?: Json | null
          auto_apply_at?: string | null
          capped?: Json | null
          carry?: number
          carry_adjustment?: number
          carry_settled_at?: string | null
          closed_at?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          cycle_end?: string | null
          cycle_start?: string | null
          figures?: Json | null
          held_snapshot?: Json | null
          id?: string
          lines?: Json | null
          month_key?: string
          pocket_id?: string | null
          rates?: Json | null
          rates_apply?: Json | null
          saved?: number
          status?: string
          target?: number
          undone_at?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "savings_month_summary_pocket_id_fkey"
            columns: ["pocket_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_transactions: {
        Row: {
          account_amount: number | null
          account_id: string
          amount: number
          balance_after: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          deleted_at: string | null
          edited_at: string
          id: string
          idempotency_key: string | null
          is_auto_save: boolean
          is_cash_flow: boolean
          kind: Database["public"]["Enums"]["savings_transaction_kind"]
          notes: string | null
          occurred_at: string | null
          pair_id: string | null
          payment_method_id: string | null
          source: string | null
          transaction_date: string
          transfer_group_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_amount?: number | null
          account_id: string
          amount: number
          balance_after?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          edited_at?: string
          id?: string
          idempotency_key?: string | null
          is_auto_save?: boolean
          is_cash_flow?: boolean
          kind: Database["public"]["Enums"]["savings_transaction_kind"]
          notes?: string | null
          occurred_at?: string | null
          pair_id?: string | null
          payment_method_id?: string | null
          source?: string | null
          transaction_date?: string
          transfer_group_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_amount?: number | null
          account_id?: string
          amount?: number
          balance_after?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          deleted_at?: string | null
          edited_at?: string
          id?: string
          idempotency_key?: string | null
          is_auto_save?: boolean
          is_cash_flow?: boolean
          kind?: Database["public"]["Enums"]["savings_transaction_kind"]
          notes?: string | null
          occurred_at?: string | null
          pair_id?: string | null
          payment_method_id?: string | null
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
          {
            foreignKeyName: "savings_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      site_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          kind: string
          locale: string
          message: string | null
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          kind: string
          locale: string
          message?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          kind?: string
          locale?: string
          message?: string | null
          name?: string | null
        }
        Relationships: []
      }
      site_stats: {
        Row: {
          day: string
          event: string
          locale: string
          n: number
          path: string
          ref: string
        }
        Insert: {
          day: string
          event: string
          locale: string
          n?: number
          path: string
          ref?: string
        }
        Update: {
          day?: string
          event?: string
          locale?: string
          n?: number
          path?: string
          ref?: string
        }
        Relationships: []
      }
      sms_corpus: {
        Row: {
          currency: string | null
          first_seen: string
          kind: string | null
          last_seen: string
          masked_version: number | null
          matched_template_id: string | null
          ok_count: number
          parse_method: string | null
          redacted_body: string
          seen_count: number
          sender_key: string | null
          skeleton_key: string
        }
        Insert: {
          currency?: string | null
          first_seen?: string
          kind?: string | null
          last_seen?: string
          masked_version?: number | null
          matched_template_id?: string | null
          ok_count?: number
          parse_method?: string | null
          redacted_body: string
          seen_count?: number
          sender_key?: string | null
          skeleton_key: string
        }
        Update: {
          currency?: string | null
          first_seen?: string
          kind?: string | null
          last_seen?: string
          masked_version?: number | null
          matched_template_id?: string | null
          ok_count?: number
          parse_method?: string | null
          redacted_body?: string
          seen_count?: number
          sender_key?: string | null
          skeleton_key?: string
        }
        Relationships: []
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
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          token_hash?: string
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
      sms_own_transfer_answers: {
        Row: {
          account_a: string
          account_b: string
          answered_at: string
          is_own: boolean
          user_id: string
        }
        Insert: {
          account_a: string
          account_b: string
          answered_at?: string
          is_own: boolean
          user_id: string
        }
        Update: {
          account_a?: string
          account_b?: string
          answered_at?: string
          is_own?: boolean
          user_id?: string
        }
        Relationships: []
      }
      sms_parse_log: {
        Row: {
          account_last4: string | null
          acked_at: string | null
          amount: number | null
          awaiting_confirmation: boolean
          balance_after: number | null
          bank_name: string | null
          bank_source: string | null
          bank_suggestion: string | null
          body_hash: string | null
          booked_day: string | null
          captured_at: string | null
          category: string | null
          clean_title: string | null
          confidence: number | null
          confirmed_at: string | null
          counterparty_hash: string | null
          counterparty_is_self: boolean | null
          counterparty_last4: string | null
          created_at: string
          currency: string | null
          debt_payment_id: string | null
          device_id: string | null
          discard_requested_at: string | null
          expense_id: string | null
          failure_code: string | null
          format_key: string | null
          harvested_at: string | null
          id: string
          income_id: string | null
          is_duplicate: boolean
          kind: string | null
          kind_source: string | null
          learn_status: string | null
          learn_template_id: string | null
          learned_at: string | null
          leg_direction: string | null
          masked_body: string | null
          masked_version: number | null
          matched_template_id: string | null
          merchant: string | null
          merchant_normalized: string | null
          own_transfer_candidate: string | null
          own_transfer_signals: string[] | null
          own_transfer_verdict: string | null
          paired_log_id: string | null
          parse_method: string | null
          parsed_at: string | null
          parsed_ok: boolean
          pattern_id: string | null
          payment_instrument: string | null
          payment_method_id: string | null
          push_result: Json | null
          pushed_at: string | null
          raw_body: string | null
          raw_expires_at: string | null
          raw_sms_summary: string | null
          received_at: string
          reference_hash: string | null
          savings_transaction_id: string | null
          sender: string | null
          shape_key: string | null
          skeleton_key: string | null
          sms_flags: string[] | null
          sms_hash: string | null
          source: string
          status: string
          template_revoked_at: string | null
          user_confirmed_at: string | null
          user_id: string
          wording_guard_hit: boolean | null
        }
        Insert: {
          account_last4?: string | null
          acked_at?: string | null
          amount?: number | null
          awaiting_confirmation?: boolean
          balance_after?: number | null
          bank_name?: string | null
          bank_source?: string | null
          bank_suggestion?: string | null
          body_hash?: string | null
          booked_day?: string | null
          captured_at?: string | null
          category?: string | null
          clean_title?: string | null
          confidence?: number | null
          confirmed_at?: string | null
          counterparty_hash?: string | null
          counterparty_is_self?: boolean | null
          counterparty_last4?: string | null
          created_at?: string
          currency?: string | null
          debt_payment_id?: string | null
          device_id?: string | null
          discard_requested_at?: string | null
          expense_id?: string | null
          failure_code?: string | null
          format_key?: string | null
          harvested_at?: string | null
          id?: string
          income_id?: string | null
          is_duplicate?: boolean
          kind?: string | null
          kind_source?: string | null
          learn_status?: string | null
          learn_template_id?: string | null
          learned_at?: string | null
          leg_direction?: string | null
          masked_body?: string | null
          masked_version?: number | null
          matched_template_id?: string | null
          merchant?: string | null
          merchant_normalized?: string | null
          own_transfer_candidate?: string | null
          own_transfer_signals?: string[] | null
          own_transfer_verdict?: string | null
          paired_log_id?: string | null
          parse_method?: string | null
          parsed_at?: string | null
          parsed_ok?: boolean
          pattern_id?: string | null
          payment_instrument?: string | null
          payment_method_id?: string | null
          push_result?: Json | null
          pushed_at?: string | null
          raw_body?: string | null
          raw_expires_at?: string | null
          raw_sms_summary?: string | null
          received_at?: string
          reference_hash?: string | null
          savings_transaction_id?: string | null
          sender?: string | null
          shape_key?: string | null
          skeleton_key?: string | null
          sms_flags?: string[] | null
          sms_hash?: string | null
          source: string
          status?: string
          template_revoked_at?: string | null
          user_confirmed_at?: string | null
          user_id: string
          wording_guard_hit?: boolean | null
        }
        Update: {
          account_last4?: string | null
          acked_at?: string | null
          amount?: number | null
          awaiting_confirmation?: boolean
          balance_after?: number | null
          bank_name?: string | null
          bank_source?: string | null
          bank_suggestion?: string | null
          body_hash?: string | null
          booked_day?: string | null
          captured_at?: string | null
          category?: string | null
          clean_title?: string | null
          confidence?: number | null
          confirmed_at?: string | null
          counterparty_hash?: string | null
          counterparty_is_self?: boolean | null
          counterparty_last4?: string | null
          created_at?: string
          currency?: string | null
          debt_payment_id?: string | null
          device_id?: string | null
          discard_requested_at?: string | null
          expense_id?: string | null
          failure_code?: string | null
          format_key?: string | null
          harvested_at?: string | null
          id?: string
          income_id?: string | null
          is_duplicate?: boolean
          kind?: string | null
          kind_source?: string | null
          learn_status?: string | null
          learn_template_id?: string | null
          learned_at?: string | null
          leg_direction?: string | null
          masked_body?: string | null
          masked_version?: number | null
          matched_template_id?: string | null
          merchant?: string | null
          merchant_normalized?: string | null
          own_transfer_candidate?: string | null
          own_transfer_signals?: string[] | null
          own_transfer_verdict?: string | null
          paired_log_id?: string | null
          parse_method?: string | null
          parsed_at?: string | null
          parsed_ok?: boolean
          pattern_id?: string | null
          payment_instrument?: string | null
          payment_method_id?: string | null
          push_result?: Json | null
          pushed_at?: string | null
          raw_body?: string | null
          raw_expires_at?: string | null
          raw_sms_summary?: string | null
          received_at?: string
          reference_hash?: string | null
          savings_transaction_id?: string | null
          sender?: string | null
          shape_key?: string | null
          skeleton_key?: string | null
          sms_flags?: string[] | null
          sms_hash?: string | null
          source?: string
          status?: string
          template_revoked_at?: string | null
          user_confirmed_at?: string | null
          user_id?: string
          wording_guard_hit?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_parse_log_debt_payment_id_fkey"
            columns: ["debt_payment_id"]
            isOneToOne: false
            referencedRelation: "debt_payments"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "sms_parse_log_learn_template_id_fkey"
            columns: ["learn_template_id"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_parse_log_matched_template_id_fkey"
            columns: ["matched_template_id"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_parse_log_paired_log_id_fkey"
            columns: ["paired_log_id"]
            isOneToOne: false
            referencedRelation: "sms_parse_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_parse_log_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_parse_log_savings_transaction_id_fkey"
            columns: ["savings_transaction_id"]
            isOneToOne: false
            referencedRelation: "savings_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_pattern_reviews: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          report: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          report?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          report?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: []
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
      sms_repair_audit: {
        Row: {
          action: string
          applied_at: string
          batch: string
          id: number
          new_values: Json | null
          old_values: Json | null
          repair_type: string
          revert_note: string | null
          reverted_at: string | null
          row_id: string
          sms_log_id: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          applied_at?: string
          batch: string
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          repair_type: string
          revert_note?: string | null
          reverted_at?: string | null
          row_id: string
          sms_log_id?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          applied_at?: string
          batch?: string
          id?: number
          new_values?: Json | null
          old_values?: Json | null
          repair_type?: string
          revert_note?: string | null
          reverted_at?: string | null
          row_id?: string
          sms_log_id?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_retention_audit: {
        Row: {
          corpus_dropped: number
          explicit_expired: number
          failed_blanked: number
          failed_deleted: number
          id: number
          never_learned_purged: number
          outcome: string
          parsed_held: boolean
          parsed_masked: number
          rejected_cap_fired: number
          rejected_purged: number
          run_at: string
        }
        Insert: {
          corpus_dropped?: number
          explicit_expired?: number
          failed_blanked?: number
          failed_deleted?: number
          id?: never
          never_learned_purged?: number
          outcome: string
          parsed_held?: boolean
          parsed_masked?: number
          rejected_cap_fired?: number
          rejected_purged?: number
          run_at?: string
        }
        Update: {
          corpus_dropped?: number
          explicit_expired?: number
          failed_blanked?: number
          failed_deleted?: number
          id?: never
          never_learned_purged?: number
          outcome?: string
          parsed_held?: boolean
          parsed_masked?: number
          rejected_cap_fired?: number
          rejected_purged?: number
          run_at?: string
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
      sms_stats_outbox: {
        Row: {
          bump_match: boolean
          ccy_confirmed: boolean | null
          ccy_currency: Database["public"]["Enums"]["currency_code"] | null
          ccy_sender: string | null
          created_at: string
          currency: string | null
          id: number
          is_txn: boolean
          kind: string | null
          kw: string[]
          kw_lang: string[]
          parse_method: string | null
          parsed_ok: boolean | null
          redacted_body: string | null
          sender: string | null
          sender_key: string | null
          skeleton_key: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          bump_match?: boolean
          ccy_confirmed?: boolean | null
          ccy_currency?: Database["public"]["Enums"]["currency_code"] | null
          ccy_sender?: string | null
          created_at?: string
          currency?: string | null
          id?: never
          is_txn?: boolean
          kind?: string | null
          kw?: string[]
          kw_lang?: string[]
          parse_method?: string | null
          parsed_ok?: boolean | null
          redacted_body?: string | null
          sender?: string | null
          sender_key?: string | null
          skeleton_key?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          bump_match?: boolean
          ccy_confirmed?: boolean | null
          ccy_currency?: Database["public"]["Enums"]["currency_code"] | null
          ccy_sender?: string | null
          created_at?: string
          currency?: string | null
          id?: never
          is_txn?: boolean
          kind?: string | null
          kw?: string[]
          kw_lang?: string[]
          parse_method?: string | null
          parsed_ok?: boolean | null
          redacted_body?: string | null
          sender?: string | null
          sender_key?: string | null
          skeleton_key?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sms_template_hard_signals: {
        Row: {
          created_at: string
          reason: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reason?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_template_hard_signals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_tracking_templates_ai"
            referencedColumns: ["id"]
          },
        ]
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
      spark_allowances: {
        Row: {
          created_at: string
          granted: number
          id: string
          kind: string
          original_period_end: string | null
          period_end: string
          period_start: string
          reason: string | null
          ref: string | null
          used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          granted: number
          id?: string
          kind: string
          original_period_end?: string | null
          period_end: string
          period_start: string
          reason?: string | null
          ref?: string | null
          used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: number
          id?: string
          kind?: string
          original_period_end?: string | null
          period_end?: string
          period_start?: string
          reason?: string | null
          ref?: string | null
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      spark_prices: {
        Row: {
          feature: string
          sparks: number
          updated_at: string
        }
        Insert: {
          feature: string
          sparks: number
          updated_at?: string
        }
        Update: {
          feature?: string
          sparks?: number
          updated_at?: string
        }
        Relationships: []
      }
      spark_products: {
        Row: {
          active: boolean
          countries: string[] | null
          product_id: string
          sparks: number
        }
        Insert: {
          active?: boolean
          countries?: string[] | null
          product_id: string
          sparks: number
        }
        Update: {
          active?: boolean
          countries?: string[] | null
          product_id?: string
          sparks?: number
        }
        Relationships: []
      }
      spark_purchases: {
        Row: {
          bonus_sparks: number
          currency: string | null
          id: string
          price_micros: number | null
          product_id: string
          purchased_at: string
          refunded_at: string | null
          remaining: number
          sparks: number
          store: string
          store_txn: string
          user_id: string
        }
        Insert: {
          bonus_sparks?: number
          currency?: string | null
          id?: string
          price_micros?: number | null
          product_id: string
          purchased_at?: string
          refunded_at?: string | null
          remaining: number
          sparks: number
          store: string
          store_txn: string
          user_id: string
        }
        Update: {
          bonus_sparks?: number
          currency?: string | null
          id?: string
          price_micros?: number | null
          product_id?: string
          purchased_at?: string
          refunded_at?: string | null
          remaining?: number
          sparks?: number
          store?: string
          store_txn?: string
          user_id?: string
        }
        Relationships: []
      }
      spark_spend: {
        Row: {
          allowance_id: string | null
          created_at: string
          feature: string
          id: number
          purchase_id: string | null
          reservation_id: string | null
          sparks: number
          user_id: string
        }
        Insert: {
          allowance_id?: string | null
          created_at?: string
          feature: string
          id?: never
          purchase_id?: string | null
          reservation_id?: string | null
          sparks: number
          user_id: string
        }
        Update: {
          allowance_id?: string | null
          created_at?: string
          feature?: string
          id?: never
          purchase_id?: string | null
          reservation_id?: string | null
          sparks?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_spend_allowance_id_fkey"
            columns: ["allowance_id"]
            isOneToOne: false
            referencedRelation: "spark_allowances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spark_spend_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "spark_purchases"
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
          edited_at: string
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
          edited_at?: string
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
          edited_at?: string
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
          attachments: Json
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
          attachments?: Json
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
          attachments?: Json
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
          app_version: string | null
          area: string | null
          assignee_id: string | null
          board_state: string
          board_summary: string | null
          board_title: string | null
          category: string
          context: Json
          created_at: string
          csat_at: string | null
          csat_comment: string | null
          csat_rating: number | null
          duplicate_of: string | null
          first_response_at: string | null
          id: string
          kind: string
          last_message_at: string | null
          last_message_from: string | null
          last_message_preview: string | null
          linear_issue_id: string | null
          linear_issue_url: string | null
          number: number
          platform: string | null
          priority: string
          requester_email: string | null
          resolved_at: string | null
          severity: string
          sla_first_response_due: string | null
          sla_resolution_due: string | null
          source: string
          staff_last_read_at: string | null
          status: string
          subject: string
          tags: string[]
          triage_confidence: number | null
          triage_state: string
          updated_at: string
          user_id: string | null
          user_last_read_at: string | null
          votes: number
        }
        Insert: {
          app_version?: string | null
          area?: string | null
          assignee_id?: string | null
          board_state?: string
          board_summary?: string | null
          board_title?: string | null
          category?: string
          context?: Json
          created_at?: string
          csat_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          duplicate_of?: string | null
          first_response_at?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_from?: string | null
          last_message_preview?: string | null
          linear_issue_id?: string | null
          linear_issue_url?: string | null
          number?: never
          platform?: string | null
          priority?: string
          requester_email?: string | null
          resolved_at?: string | null
          severity?: string
          sla_first_response_due?: string | null
          sla_resolution_due?: string | null
          source?: string
          staff_last_read_at?: string | null
          status?: string
          subject: string
          tags?: string[]
          triage_confidence?: number | null
          triage_state?: string
          updated_at?: string
          user_id?: string | null
          user_last_read_at?: string | null
          votes?: number
        }
        Update: {
          app_version?: string | null
          area?: string | null
          assignee_id?: string | null
          board_state?: string
          board_summary?: string | null
          board_title?: string | null
          category?: string
          context?: Json
          created_at?: string
          csat_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          duplicate_of?: string | null
          first_response_at?: string | null
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_from?: string | null
          last_message_preview?: string | null
          linear_issue_id?: string | null
          linear_issue_url?: string | null
          number?: never
          platform?: string | null
          priority?: string
          requester_email?: string | null
          resolved_at?: string | null
          severity?: string
          sla_first_response_due?: string | null
          sla_resolution_due?: string | null
          source?: string
          staff_last_read_at?: string | null
          status?: string
          subject?: string
          tags?: string[]
          triage_confidence?: number | null
          triage_state?: string
          updated_at?: string
          user_id?: string | null
          user_last_read_at?: string | null
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_claims: {
        Row: {
          claimed_at: string
          email_key: string
          user_id: string | null
        }
        Insert: {
          claimed_at?: string
          email_key: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string
          email_key?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_id: string
          last_used_at: string
          secret_hash: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          last_used_at?: string
          secret_hash?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          last_used_at?: string
          secret_hash?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          app_version: string | null
          collects_sms: boolean
          created_at: string
          device_id: string
          first_sms_at: string | null
          install_key: string | null
          is_main: boolean
          last_seen_at: string
          last_sms_at: string | null
          model: string | null
          name: string | null
          notify: boolean | null
          notify_on_sms: boolean | null
          platform: string
          push_permission: string | null
          revoked_at: string | null
          session_id: string | null
          sms_evicted_count: number
          sms_last_result: string | null
          sms_queue_oldest_at: string | null
          sms_queue_pending: number
          sms_queue_reported_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          collects_sms?: boolean
          created_at?: string
          device_id: string
          first_sms_at?: string | null
          install_key?: string | null
          is_main?: boolean
          last_seen_at?: string
          last_sms_at?: string | null
          model?: string | null
          name?: string | null
          notify?: boolean | null
          notify_on_sms?: boolean | null
          platform: string
          push_permission?: string | null
          revoked_at?: string | null
          session_id?: string | null
          sms_evicted_count?: number
          sms_last_result?: string | null
          sms_queue_oldest_at?: string | null
          sms_queue_pending?: number
          sms_queue_reported_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          collects_sms?: boolean
          created_at?: string
          device_id?: string
          first_sms_at?: string | null
          install_key?: string | null
          is_main?: boolean
          last_seen_at?: string
          last_sms_at?: string | null
          model?: string | null
          name?: string | null
          notify?: boolean | null
          notify_on_sms?: boolean | null
          platform?: string
          push_permission?: string | null
          revoked_at?: string | null
          session_id?: string | null
          sms_evicted_count?: number
          sms_last_result?: string | null
          sms_queue_oldest_at?: string | null
          sms_queue_pending?: number
          sms_queue_reported_at?: string | null
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
          grace_ends_at: string | null
          granted_by: string | null
          last_event_at: string | null
          limit_overrides: Json
          note: string | null
          plan_key: string
          product_id: string | null
          source: string
          status: string
          stay_offer_claimed_at: string | null
          stay_offer_redeemed_at: string | null
          store: string | null
          store_country: string | null
          store_original_txn: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          will_renew: boolean | null
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          feature_overrides?: Json
          grace_ends_at?: string | null
          granted_by?: string | null
          last_event_at?: string | null
          limit_overrides?: Json
          note?: string | null
          plan_key: string
          product_id?: string | null
          source?: string
          status?: string
          stay_offer_claimed_at?: string | null
          stay_offer_redeemed_at?: string | null
          store?: string | null
          store_country?: string | null
          store_original_txn?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          will_renew?: boolean | null
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          feature_overrides?: Json
          grace_ends_at?: string | null
          granted_by?: string | null
          last_event_at?: string | null
          limit_overrides?: Json
          note?: string | null
          plan_key?: string
          product_id?: string | null
          source?: string
          status?: string
          stay_offer_claimed_at?: string | null
          stay_offer_redeemed_at?: string | null
          store?: string | null
          store_country?: string | null
          store_original_txn?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          will_renew?: boolean | null
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
      user_milestones: {
        Row: {
          first_at: string
          milestone: string
          user_id: string
        }
        Insert: {
          first_at: string
          milestone: string
          user_id: string
        }
        Update: {
          first_at?: string
          milestone?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_provider: string
          budget_entry_mode: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout: Database["public"]["Enums"]["dashboard_layout"]
          enable_ai: boolean
          goal_alerts: boolean
          goal_progress_alerts: boolean
          language: Database["public"]["Enums"]["locale_code"]
          month_start_day: number
          no_income_declared: boolean
          privacy: Json
          prompt_state: Json
          show_all_currencies_in_forms: boolean
          show_cents_in_dashboard: boolean
          show_secondary_currency: boolean
          sms_first_enabled_at: string | null
          sms_tracking_enabled: boolean
          sub_due_reminders: boolean
          sub_price_alerts: boolean
          theme: Database["public"]["Enums"]["theme_mode"]
          timezone: string | null
          tutorial_current_step: string | null
          tutorials_completed: string[]
          two_factor_email_enabled: boolean
          updated_at: string
          user_id: string
          wealth_gold_strip: string
          week_start_day: number | null
        }
        Insert: {
          ai_provider?: string
          budget_entry_mode?: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout?: Database["public"]["Enums"]["dashboard_layout"]
          enable_ai?: boolean
          goal_alerts?: boolean
          goal_progress_alerts?: boolean
          language?: Database["public"]["Enums"]["locale_code"]
          month_start_day?: number
          no_income_declared?: boolean
          privacy?: Json
          prompt_state?: Json
          show_all_currencies_in_forms?: boolean
          show_cents_in_dashboard?: boolean
          show_secondary_currency?: boolean
          sms_first_enabled_at?: string | null
          sms_tracking_enabled?: boolean
          sub_due_reminders?: boolean
          sub_price_alerts?: boolean
          theme?: Database["public"]["Enums"]["theme_mode"]
          timezone?: string | null
          tutorial_current_step?: string | null
          tutorials_completed?: string[]
          two_factor_email_enabled?: boolean
          updated_at?: string
          user_id: string
          wealth_gold_strip?: string
          week_start_day?: number | null
        }
        Update: {
          ai_provider?: string
          budget_entry_mode?: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout?: Database["public"]["Enums"]["dashboard_layout"]
          enable_ai?: boolean
          goal_alerts?: boolean
          goal_progress_alerts?: boolean
          language?: Database["public"]["Enums"]["locale_code"]
          month_start_day?: number
          no_income_declared?: boolean
          privacy?: Json
          prompt_state?: Json
          show_all_currencies_in_forms?: boolean
          show_cents_in_dashboard?: boolean
          show_secondary_currency?: boolean
          sms_first_enabled_at?: string | null
          sms_tracking_enabled?: boolean
          sub_due_reminders?: boolean
          sub_price_alerts?: boolean
          theme?: Database["public"]["Enums"]["theme_mode"]
          timezone?: string | null
          tutorial_current_step?: string | null
          tutorials_completed?: string[]
          two_factor_email_enabled?: boolean
          updated_at?: string
          user_id?: string
          wealth_gold_strip?: string
          week_start_day?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      app_activity_days: {
        Row: {
          active_seconds: number | null
          day: string | null
          last_event_at: string | null
          sessions: number | null
          user_id: string | null
        }
        Relationships: []
      }
      gate3_preview_monthly: {
        Row: {
          month: string | null
          sms_accounts_receiving: number | null
          sparks_used: number | null
          third_account_receiving: boolean | null
          used_sparks: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
      loyalty_action_days: {
        Row: {
          day: string | null
          source: string | null
          user_id: string | null
        }
        Relationships: []
      }
      sms_ai_today: {
        Row: {
          ai_count_today: number | null
          user_id: string | null
        }
        Relationships: []
      }
      sms_parse_today: {
        Row: {
          parsed_count_today: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_debt_payment_with_expense: {
        Args: { p_expense: Json; p_payment: Json }
        Returns: Json
      }
      add_income_with_debt: {
        Args: { p_debt: Json; p_income: Json }
        Returns: Json
      }
      add_sms_debt_payment_with_expense: {
        Args: {
          p_expense: Json
          p_payment: Json
          p_sms_log_id: string
          p_user_id: string
        }
        Returns: Json
      }
      add_subscription_with_recurring_expense: {
        Args: { p_recurring_expense: Json; p_subscription: Json }
        Returns: Json
      }
      adjust_pocket_balance: {
        Args: {
          p_date?: string
          p_delta: number
          p_group: string
          p_kind: Database["public"]["Enums"]["savings_transaction_kind"]
          p_note?: string
          p_payment_method?: string
          p_pocket: string
          p_source?: string
          p_user: string
        }
        Returns: number
      }
      admin_activity_series: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          day: string
          sessions: number
        }[]
      }
      admin_adjust_loyalty_points: {
        Args: {
          p_actor: string
          p_delta: number
          p_reason: string
          p_user: string
        }
        Returns: {
          balance: number
          tier: string
        }[]
      }
      admin_ai_cost_daily: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          calls: number
          cost_usd_micro: number
          day: string
          feature: string
          in_tokens: number
          model: string
          out_tokens: number
        }[]
      }
      admin_billing_counts: { Args: { p_days?: number }; Returns: Json }
      admin_email_status_counts: {
        Args: {
          p_from?: string
          p_locale?: string
          p_q?: string
          p_template?: string
          p_to?: string
        }
        Returns: {
          n: number
          status: string
        }[]
      }
      admin_entitlement_counts: {
        Args: never
        Returns: {
          n: number
          plan_key: string
          status: string
        }[]
      }
      admin_feature_adoption: { Args: never; Returns: Json }
      admin_founder_candidates: {
        Args: never
        Returns: {
          account_created: string
          action_days: number
          proposed_at: string
          provider: string
          qualified_at: string
          record_count: number
          sms_on: boolean
          user_id: string
        }[]
      }
      admin_funnel: { Args: { p_days?: number }; Returns: Json }
      admin_granted_users: {
        Args: { p_staff: string; p_users: string[] }
        Returns: string[]
      }
      admin_has_grant: {
        Args: { p_scope: string; p_staff: string; p_user: string }
        Returns: boolean
      }
      admin_loyalty_summary: { Args: never; Returns: Json }
      admin_onboarding_funnel: { Args: { p_days?: number }; Returns: Json }
      admin_overview: { Args: never; Returns: Json }
      admin_push_platform_counts: {
        Args: never
        Returns: {
          n: number
          platform: string
        }[]
      }
      admin_rate_hit: {
        Args: { p_key: string; p_max_hits: number; p_window_seconds: number }
        Returns: boolean
      }
      admin_refresh_metrics: { Args: never; Returns: undefined }
      admin_refresh_metrics_if_stale: {
        Args: { p_max_age?: string }
        Returns: boolean
      }
      admin_retention: { Args: { p_weeks?: number }; Returns: Json }
      admin_retention_days: { Args: { p_signup_days?: number }; Returns: Json }
      admin_rewards_add_freezes: {
        Args: { p_actor: string; p_count: number; p_user: string }
        Returns: Json
      }
      admin_rewards_bank_pro_days: {
        Args: { p_actor: string; p_days: number; p_user: string }
        Returns: Json
      }
      admin_rewards_founder_remove: {
        Args: { p_actor: string; p_user: string }
        Returns: Json
      }
      admin_rewards_founder_set: {
        Args: { p_actor: string; p_number?: number; p_user: string }
        Returns: Json
      }
      admin_rewards_loyalty_reset: {
        Args: { p_actor: string; p_user: string }
        Returns: Json
      }
      admin_rewards_platform_switch: {
        Args: { p_actor: string; p_enabled: boolean; p_key: string }
        Returns: Json
      }
      admin_rewards_pro_grant: {
        Args: {
          p_actor: string
          p_ends_at?: string
          p_note?: string
          p_user: string
        }
        Returns: Json
      }
      admin_rewards_pro_remove: {
        Args: { p_actor: string; p_note?: string; p_user: string }
        Returns: Json
      }
      admin_rewards_referral_approve: {
        Args: { p_actor: string; p_referral: number }
        Returns: Json
      }
      admin_rewards_referral_mark_activated: {
        Args: { p_actor: string; p_referral: number }
        Returns: Json
      }
      admin_rewards_referral_revoke: {
        Args: { p_actor: string; p_referral: number }
        Returns: Json
      }
      admin_rewards_referrals_for: { Args: { p_user: string }; Returns: Json }
      admin_rewards_set_streak: {
        Args: {
          p_actor: string
          p_last_kept_week?: string
          p_step?: number
          p_user: string
          p_weeks: number
        }
        Returns: Json
      }
      admin_rewards_set_tier: {
        Args: {
          p_actor: string
          p_locked: boolean
          p_tier: string
          p_user: string
        }
        Returns: Json
      }
      admin_rewards_sparks_adjust: {
        Args: {
          p_actor: string
          p_amount: number
          p_bucket: string
          p_reason: string
          p_user: string
        }
        Returns: Json
      }
      admin_rewards_sparks_ledger: {
        Args: { p_limit?: number; p_user: string }
        Returns: Json
      }
      admin_rewards_trial_end: {
        Args: { p_actor: string; p_user: string }
        Returns: Json
      }
      admin_rewards_trial_start: {
        Args: { p_actor: string; p_days?: number; p_user: string }
        Returns: Json
      }
      admin_rewards_unbank_pro_days: {
        Args: { p_actor: string; p_user: string }
        Returns: Json
      }
      admin_signup_series: {
        Args: { p_days?: number }
        Returns: {
          day: string
          signups: number
        }[]
      }
      admin_sms_health: { Args: { p_days?: number }; Returns: Json }
      admin_ticket_counts: {
        Args: never
        Returns: {
          assignee_id: string
          n: number
          priority: string
          status: string
        }[]
      }
      admin_trial_grants_daily: {
        Args: { p_days?: number }
        Returns: {
          day: string
          granted: number
        }[]
      }
      admin_user_directory: {
        Args: {
          p_limit?: number
          p_match_email?: boolean
          p_offset?: number
          p_order?: string
          p_plan?: string
          p_search?: string
          p_state?: string
          p_with_total?: boolean
        }
        Returns: Json
      }
      admin_user_financial_snapshot: {
        Args: { p_staff: string; p_user: string }
        Returns: Json
      }
      admin_user_overview: { Args: { p_user: string }; Returns: Json }
      advisor_gate: { Args: { p_user: string }; Returns: Json }
      ai_chat_error_check: { Args: never; Returns: number }
      ai_cost_usd_micro:
        | {
            Args: {
              p_cached: number
              p_in: number
              p_model: string
              p_out: number
            }
            Returns: number
          }
        | {
            Args: {
              p_audio_seconds: number
              p_cached: number
              p_extra_micro: number
              p_in: number
              p_model: string
              p_out: number
            }
            Returns: number
          }
      ai_credit_windows: {
        Args: { p_t: string; p_user: string }
        Returns: Json
      }
      ai_default_limits: { Args: never; Returns: Json }
      ai_effective_limits: { Args: { p_user: string }; Returns: Json }
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
      ai_quota_reserve_v2: {
        Args: {
          p_advisor_free?: boolean
          p_chat: string
          p_est: number
          p_feature: string
          p_turn?: string
          p_user: string
        }
        Returns: Json
      }
      ai_quota_reserve_v2_core: {
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
          p_audio_seconds?: number
          p_cached: number
          p_extra_cost_micro?: number
          p_in: number
          p_latency: number
          p_model: string
          p_out: number
          p_provisional?: boolean
          p_reservation: string
          p_status: string
          p_tier: string
          p_units: number
          p_user: string
          p_visible?: boolean
        }
        Returns: undefined
      }
      ai_quota_settle_core: {
        Args: {
          p_audio_seconds?: number
          p_cached: number
          p_extra_cost_micro?: number
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
        Returns: number
      }
      ai_quota_status: { Args: { p_user: string }; Returns: Json }
      ai_spend_today: { Args: never; Returns: Json }
      ai_turn_close_charged: {
        Args: { p_reservation: string; p_turn: string; p_user: string }
        Returns: undefined
      }
      ai_usage_state: { Args: { p_user: string }; Returns: Json }
      analytics_rollup: { Args: never; Returns: number }
      analytics_touch: {
        Args: { p_paths?: Json; p_seconds?: number; p_sessions?: number }
        Returns: undefined
      }
      api_rate_hit: {
        Args: { p_key: string; p_max_hits: number; p_window_seconds: number }
        Returns: boolean
      }
      app_version_below: {
        Args: { p_min: string; p_version: string }
        Returns: boolean
      }
      apply_month_end: {
        Args: {
          p_by?: string
          p_capped?: Json
          p_held: Json
          p_id: string
          p_lines: Json
          p_rates: Json
          p_user: string
          p_version: number
        }
        Returns: Json
      }
      assert_debt_owned: {
        Args: { p_debt: string; p_user: string }
        Returns: undefined
      }
      assert_payment_method_owned: {
        Args: { p_pm: string; p_user: string }
        Returns: undefined
      }
      balance_view: { Args: { p_payment_method: string }; Returns: Json }
      billing_apply: {
        Args: {
          p_effect: Json
          p_event_id: string
          p_event_ms: number
          p_type: string
          p_user: string
        }
        Returns: string
      }
      billing_enabled: { Args: never; Returns: boolean }
      billing_note: {
        Args: {
          p_event_id: string
          p_event_ms: number
          p_type: string
          p_user: string
        }
        Returns: undefined
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
      bump_sms_template_failure_v2: {
        Args: {
          p_hard?: boolean
          p_reason?: string
          p_template_id: string
          p_user_id?: string
        }
        Returns: string
      }
      cancel_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      cast_feedback_vote: {
        Args: {
          p_threshold?: number
          p_ticket: string
          p_user: string
          p_value: number
        }
        Returns: Json
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
      coming_soon_notify: { Args: { p_feature: string }; Returns: undefined }
      correct_savings_balance: {
        Args: {
          p_account_id: string
          p_new_balance: number
          p_notes?: string
          p_transaction_id?: string
        }
        Returns: string
      }
      correct_savings_balance_v2: {
        Args: {
          p_account_id: string
          p_local_date: string
          p_new_balance: number
          p_notes?: string
          p_transaction_id: string
        }
        Returns: string
      }
      db_retention: { Args: never; Returns: number }
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
      deposit_to_savings_v2: {
        Args: {
          p_account_id: string
          p_amount: number
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_local_date: string
          p_notes?: string
          p_transaction_id: string
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
      devices_supersede: {
        Args: { p_new: string; p_old: string; p_user: string }
        Returns: boolean
      }
      entitlement_grants: {
        Args: {
          p_grace_ends: string
          p_now: string
          p_period_end: string
          p_status: string
          p_trial_ends: string
        }
        Returns: boolean
      }
      entitlements_state: { Args: { p_user: string }; Returns: Json }
      find_unclaimed_debt_payment: {
        Args: {
          p_amount: number
          p_date: string
          p_debt: string
          p_expense_id: string
          p_pm: string
          p_user: string
        }
        Returns: string
      }
      get_sms_keyword_pool: {
        Args: { top_n?: number }
        Returns: {
          hit_count: number
          keyword: string
          lang: string
        }[]
      }
      housekeeping: { Args: { p_analytics_days?: number }; Returns: Json }
      increment_sms_template_match_count: {
        Args: { p_id: string }
        Returns: undefined
      }
      integration_outbox_claim: {
        Args: { p_limit: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          ticket_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "integration_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      jsonb_counts_add: { Args: { a: Json; b: Json }; Returns: Json }
      label_part: {
        Args: {
          p_amount: number
          p_date?: string
          p_key: string
          p_kind: Database["public"]["Enums"]["savings_transaction_kind"]
          p_note?: string
          p_pair?: string
          p_part: string
          p_source: string
          p_user: string
        }
        Returns: number
      }
      latest_balance_reports: {
        Args: never
        Returns: {
          balance: number
          created_at: string
          currency: string | null
          id: string
          payment_method_id: string
          reported_at: string
          sms_parse_log_id: string | null
          source: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "account_balance_reports"
          isOneToOne: false
          isSetofReturn: true
        }
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
      loyalty_apply_cosmetic: {
        Args: { p_key: string; p_kind: string }
        Returns: string
      }
      loyalty_award: {
        Args: {
          p_points: number
          p_reason: string
          p_ref: string
          p_user: string
        }
        Returns: number
      }
      loyalty_close_periods: { Args: { p_user?: string }; Returns: number }
      loyalty_credits: {
        Args: never
        Returns: {
          credit_name: string
          number: number
        }[]
      }
      loyalty_decide_credit_name: {
        Args: { p_approve: boolean; p_user: string }
        Returns: string
      }
      loyalty_decide_founder: {
        Args: {
          p_actor: string
          p_approve: boolean
          p_credit_name?: string
          p_user: string
        }
        Returns: number
      }
      loyalty_founder_bar: {
        Args: { p_users: string[] }
        Returns: {
          action_days: number
          qualified_at: string
          user_id: string
          weeks: number
        }[]
      }
      loyalty_gap_uncovered: {
        Args: { p_from: string; p_to: string; p_user: string }
        Returns: number
      }
      loyalty_grant_founders: { Args: never; Returns: number }
      loyalty_local_day: {
        Args: { p_ts: string; p_tz: string }
        Returns: string
      }
      loyalty_next_founder_number: { Args: never; Returns: number }
      loyalty_pro_active: { Args: { p_user: string }; Returns: boolean }
      loyalty_record_week_check: { Args: { p_week: string }; Returns: Json }
      loyalty_refresh_pro_tiers: { Args: never; Returns: number }
      loyalty_refresh_tier: { Args: { p_user: string }; Returns: string }
      loyalty_repairable_week: { Args: { p_user: string }; Returns: string }
      loyalty_request_credit_name: { Args: { p_name: string }; Returns: string }
      loyalty_shop_buy: { Args: { p_item: string }; Returns: Json }
      loyalty_tier_key: {
        Args: { p_founder: boolean; p_lifetime: number; p_pro: boolean }
        Returns: string
      }
      loyalty_tiers_enabled: { Args: never; Returns: boolean }
      loyalty_week_start: {
        Args: { p_day: string; p_week_start: number }
        Returns: string
      }
      loyalty_week_summary: { Args: never; Returns: Json }
      month_end_due_users: {
        Args: { p_after?: string; p_limit?: number; p_user?: string }
        Returns: Json
      }
      month_end_ledger: {
        Args: { p_cycle_start: string; p_user: string }
        Returns: Json
      }
      notification_candidate_users: { Args: never; Returns: string[] }
      notification_due_users: {
        Args: { p_after?: string; p_limit?: number; p_now?: string }
        Returns: {
          goal_alerts: boolean
          is_candidate: boolean
          language: string
          month_start_day: number
          sub_due_reminders: boolean
          sub_price_alerts: boolean
          timezone: string
          user_id: string
        }[]
      }
      notifications_tick: { Args: never; Returns: boolean }
      promo_apply_banked: { Args: { p_user: string }; Returns: number }
      publish_email_template: {
        Args: { p_key: string; p_locale: string; p_staff: string }
        Returns: number
      }
      push_token_sweep: { Args: never; Returns: Json }
      reactivate_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      record_client_crash: {
        Args: {
          p_build: string
          p_culprit: string
          p_device_id: string
          p_fingerprint: string
          p_level: string
          p_platform: string
          p_release: string
          p_seen: string
          p_sentry_issue_id: string
          p_sentry_url: string
          p_stack: string
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      record_client_crash_v2: {
        Args: {
          p_build: string
          p_culprit: string
          p_device_id: string
          p_event_id?: string
          p_fingerprint: string
          p_level: string
          p_platform: string
          p_release: string
          p_seen: string
          p_sentry_issue_id: string
          p_sentry_url: string
          p_stack: string
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      record_paywall_view: {
        Args: { p_platform: string; p_source: string; p_user: string }
        Returns: undefined
      }
      record_second_factor: {
        Args: { p_method: string; p_session: string; p_user: string }
        Returns: undefined
      }
      record_sms_template_shadow: {
        Args: { p_agreed: boolean; p_template_id: string }
        Returns: string
      }
      referral_clawback: {
        Args: { p_id: number; p_status?: string }
        Returns: string
      }
      referral_ensure_code: { Args: { p_user: string }; Returns: string }
      referral_evaluate: {
        Args: { p_invitee?: string; p_limit?: number }
        Returns: number
      }
      referral_inviter_first_name: { Args: { p_code: string }; Returns: string }
      referral_my_summary: { Args: never; Returns: Json }
      referral_redeem: {
        Args: {
          p_code: string
          p_device_id?: string
          p_ip?: string
          p_legacy_key?: string
          p_mailbox_key?: string
          p_user: string
        }
        Returns: Json
      }
      referral_reward: {
        Args: { p_force?: boolean; p_id: number }
        Returns: string
      }
      referrals_enabled: { Args: never; Returns: boolean }
      refresh_user_milestones: { Args: never; Returns: undefined }
      revoke_auth_session: {
        Args: { p_session: string; p_user: string }
        Returns: number
      }
      rewards_admin_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_meta?: Json
          p_summary: string
          p_user: string
        }
        Returns: string
      }
      rewards_daily: { Args: { p_budget_ms?: number }; Returns: Json }
      rewards_touch: { Args: { p_user: string }; Returns: undefined }
      savings_balance_drift: {
        Args: never
        Returns: {
          current_balance: number
          id: string
          ledger_expected: number
        }[]
      }
      second_factor_status: { Args: never; Returns: Json }
      second_factor_verified: {
        Args: { p_amr: Json; p_session: string; p_user: string }
        Returns: boolean
      }
      session_is_live: { Args: { p_session: string }; Returns: boolean }
      site_stat_bump: {
        Args: {
          p_event: string
          p_locale: string
          p_path: string
          p_ref: string
        }
        Returns: undefined
      }
      sms_coverage_by_bank: { Args: never; Returns: Json }
      sms_discard_after_confirm: {
        Args: { p_log_id: string; p_user_id: string }
        Returns: Json
      }
      sms_discard_message: {
        Args: { p_log_id: string; p_user_id: string }
        Returns: Json
      }
      sms_heal_stuck: { Args: never; Returns: number }
      sms_last4_match: { Args: { a: string; b: string }; Returns: boolean }
      sms_leg_direction: {
        Args: { p_kind: string; p_leg_direction: string }
        Returns: string
      }
      sms_legacy_harvest_pending: { Args: never; Returns: number }
      sms_mark_acked: {
        Args: { p_log_id: string; p_user_id: string }
        Returns: undefined
      }
      sms_mark_pushed: {
        Args: { p_delivered: boolean; p_log_id: string; p_result: Json }
        Returns: undefined
      }
      sms_pair_guards_ok: {
        Args: {
          p_self: Database["public"]["Tables"]["sms_parse_log"]["Row"]
          p_self_currency: string
          p_self_direction: string
          p_self_kind: string
          p_sib: Database["public"]["Tables"]["sms_parse_log"]["Row"]
        }
        Returns: boolean
      }
      sms_promotion_candidates: {
        Args: never
        Returns: {
          age_days: number
          match_count: number
          sender: string
          template_id: string
          unique_user_count: number
        }[]
      }
      sms_repayment_fee_proven: {
        Args: {
          p_self: Database["public"]["Tables"]["sms_parse_log"]["Row"]
          p_self_kind: string
          p_sib: Database["public"]["Tables"]["sms_parse_log"]["Row"]
        }
        Returns: boolean
      }
      sms_retention: { Args: never; Returns: number }
      sms_review_pack: {
        Args: { period_end: string; period_start: string }
        Returns: Json
      }
      sms_run_my_pending_discards: { Args: never; Returns: number }
      sms_run_pending_discards: { Args: { p_user?: string }; Returns: number }
      sms_s3_apply: {
        Args: {
          p_batch: string
          p_expected?: Json
          p_log_ids: string[]
          p_repair_type: string
        }
        Returns: Json
      }
      sms_s3_record_insert: {
        Args: {
          p_batch: string
          p_log_id: string
          p_repair_type: string
          p_row_id: string
          p_table: string
        }
        Returns: number
      }
      sms_s3_revert: {
        Args: { p_batch: string; p_repair_type?: string }
        Returns: Json
      }
      sms_safe_tz: { Args: { p: string }; Returns: string }
      sms_stats_drain: { Args: { p_limit?: number }; Returns: number }
      sms_templates_awaiting_adjudication: {
        Args: { p_undo_grace_seconds?: number }
        Returns: {
          pending: number
          template_id: string
        }[]
      }
      sms_tick: { Args: never; Returns: number }
      sms_try_pair: {
        Args: {
          p_amount: number
          p_amount_tolerance?: number
          p_currency?: string
          p_direction?: string
          p_fee_proven?: boolean
          p_log_id: string
          p_match_kinds: string[]
          p_received_at: string
          p_reference?: string
          p_require_equal_amount: boolean
          p_require_registered_sibling?: boolean
          p_self_kind?: string
          p_sibling_id?: string
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
      sms_zero_variance_sweep: { Args: never; Returns: number }
      spark_available: {
        Args: { p_t: string; p_user: string }
        Returns: number
      }
      spark_charge: {
        Args: {
          p_feature: string
          p_reservation: string
          p_sparks: number
          p_user: string
        }
        Returns: number
      }
      spark_end_plan_period: {
        Args: { p_at: string; p_user: string }
        Returns: number
      }
      spark_ensure_allowance: {
        Args: { p_granted: number; p_t: string; p_user: string }
        Returns: undefined
      }
      spark_grant_reward: {
        Args: {
          p_gift?: boolean
          p_reason: string
          p_ref: string
          p_sparks: number
          p_user: string
        }
        Returns: number
      }
      spark_open_plan_period: {
        Args: {
          p_end: string
          p_granted: number
          p_ref: string
          p_start: string
          p_user: string
        }
        Returns: boolean
      }
      spark_open_trial: {
        Args: {
          p_end: string
          p_granted: number
          p_start: string
          p_user: string
        }
        Returns: boolean
      }
      spark_pack_bonus_percent: {
        Args: { p_at?: string; p_user: string }
        Returns: number
      }
      spark_pack_grant: {
        Args: {
          p_at: string
          p_currency: string
          p_price_micros: number
          p_product: string
          p_store: string
          p_txn: string
          p_user: string
        }
        Returns: number
      }
      spark_pack_refund: { Args: { p_store_txn: string }; Returns: number }
      spark_restore_plan_period: { Args: { p_user: string }; Returns: number }
      stable_uuid: {
        Args: { p_legacy: string; p_user_id: string }
        Returns: string
      }
      stay_offer_claim: { Args: { p_user: string }; Returns: Json }
      stay_offer_state: { Args: { p_user: string }; Returns: Json }
      support_submit: {
        Args: {
          p_area: string
          p_body: string
          p_confidence: number
          p_context: Json
          p_email: string
          p_kind: string
          p_platform: string
          p_severity: string
          p_state: string
          p_subject: string
          p_to_linear: boolean
          p_user: string
          p_version: string
        }
        Returns: {
          ticket_id: string
          ticket_number: number
        }[]
      }
      sync_changed_since: { Args: { p_since: string }; Returns: boolean }
      sync_pull: { Args: { p_since?: string }; Returns: Json }
      sync_pull_v2: { Args: { p_since?: string }; Returns: Json }
      sync_table_delta: {
        Args: { p_table: string; p_win: string }
        Returns: Json
      }
      trial_claim: {
        Args: { p_email_key: string; p_legacy_key?: string; p_user: string }
        Returns: Json
      }
      undo_month_end: { Args: { p_id: string; p_user: string }; Returns: Json }
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
      usage_reset: {
        Args: {
          p_actor: string
          p_reason: string
          p_scope: string
          p_user: string
        }
        Returns: undefined
      }
      usage_resets_seen: { Args: { p_user: string }; Returns: undefined }
      user_id_by_email: { Args: { p_email: string }; Returns: string }
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
      withdraw_from_savings_v2: {
        Args: {
          p_account_id: string
          p_amount: number
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_local_date: string
          p_notes?: string
          p_transaction_id: string
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
      goal_status: "active" | "paused" | "achieved" | "cancelled"
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
      goal_status: ["active", "paused", "achieved", "cancelled"],
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
