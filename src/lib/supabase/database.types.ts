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
      backfill_issues: {
        Row: {
          created_at: string
          entity: string
          id: number
          legacy_id: string | null
          payload: Json | null
          reason: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity: string
          id?: number
          legacy_id?: string | null
          payload?: Json | null
          reason: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity?: string
          id?: number
          legacy_id?: string | null
          payload?: Json | null
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          icon: string
          id: string
          is_savings: boolean
          name: string
          plan_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          icon?: string
          id?: string
          is_savings?: boolean
          name: string
          plan_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          icon?: string
          id?: string
          is_savings?: boolean
          name?: string
          plan_id?: string
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
      budget_plans: {
        Row: {
          buddgy_flow: Json | null
          buddgy_guided_complete: boolean
          created_at: string
          household: Database["public"]["Enums"]["budget_household"] | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buddgy_flow?: Json | null
          buddgy_guided_complete?: boolean
          created_at?: string
          household?: Database["public"]["Enums"]["budget_household"] | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buddgy_flow?: Json | null
          buddgy_guided_complete?: boolean
          created_at?: string
          household?: Database["public"]["Enums"]["budget_household"] | null
          id?: string
          name?: string
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
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          debt_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_id?: string
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
          created_at: string
          creditor: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          debt_type: Database["public"]["Enums"]["debt_kind"]
          description: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          gold_karat: Database["public"]["Enums"]["gold_karat"] | null
          id: string
          installment_count: number | null
          installment_frequency:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_name: string | null
          installment_provider:
            | Database["public"]["Enums"]["installment_provider"]
            | null
          installment_start_date: string | null
          interest_free: boolean
          interest_rate: number
          is_gold: boolean
          linked_credit_card_debt_id: string | null
          name: string
          notes: string | null
          person: string | null
          received_via: Database["public"]["Enums"]["debt_received_via"] | null
          relationship: string | null
          remaining_amount: number | null
          started_at: string | null
          starting_balance: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          creditor?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_type?: Database["public"]["Enums"]["debt_kind"]
          description?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          gold_karat?: Database["public"]["Enums"]["gold_karat"] | null
          id?: string
          installment_count?: number | null
          installment_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_name?: string | null
          installment_provider?:
            | Database["public"]["Enums"]["installment_provider"]
            | null
          installment_start_date?: string | null
          interest_free?: boolean
          interest_rate?: number
          is_gold?: boolean
          linked_credit_card_debt_id?: string | null
          name: string
          notes?: string | null
          person?: string | null
          received_via?: Database["public"]["Enums"]["debt_received_via"] | null
          relationship?: string | null
          remaining_amount?: number | null
          started_at?: string | null
          starting_balance?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          creditor?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          debt_type?: Database["public"]["Enums"]["debt_kind"]
          description?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          gold_karat?: Database["public"]["Enums"]["gold_karat"] | null
          id?: string
          installment_count?: number | null
          installment_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          installment_item_name?: string | null
          installment_provider?:
            | Database["public"]["Enums"]["installment_provider"]
            | null
          installment_start_date?: string | null
          interest_free?: boolean
          interest_rate?: number
          is_gold?: boolean
          linked_credit_card_debt_id?: string | null
          name?: string
          notes?: string | null
          person?: string | null
          received_via?: Database["public"]["Enums"]["debt_received_via"] | null
          relationship?: string | null
          remaining_amount?: number | null
          started_at?: string | null
          starting_balance?: number | null
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
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string | null
          expense_date: string
          id: string
          is_debt_payment: boolean
          linked_debt_payment_id: string | null
          linked_subscription_id: string | null
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
          description?: string | null
          expense_date?: string
          id?: string
          is_debt_payment?: boolean
          linked_debt_payment_id?: string | null
          linked_subscription_id?: string | null
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
          description?: string | null
          expense_date?: string
          id?: string
          is_debt_payment?: boolean
          linked_debt_payment_id?: string | null
          linked_subscription_id?: string | null
          notes?: string | null
          payment_method_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
        ]
      }
      goals: {
        Row: {
          achieved_at: string | null
          category: Database["public"]["Enums"]["goal_category"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          emoji: string
          id: string
          linked_debt_ids: string[]
          linked_savings_account_ids: string[]
          manual_current_amount: number
          monthly_contribution: number | null
          monthly_spending_limit: number | null
          name: string
          notes: string | null
          priority: number
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
          emoji?: string
          id?: string
          linked_debt_ids?: string[]
          linked_savings_account_ids?: string[]
          manual_current_amount?: number
          monthly_contribution?: number | null
          monthly_spending_limit?: number | null
          name: string
          notes?: string | null
          priority?: number
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
          emoji?: string
          id?: string
          linked_debt_ids?: string[]
          linked_savings_account_ids?: string[]
          manual_current_amount?: number
          monthly_contribution?: number | null
          monthly_spending_limit?: number | null
          name?: string
          notes?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          target_date?: string | null
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
          id: string
          is_recurring: boolean
          name: string
          notes: string | null
          payment_method_id: string | null
          recurring_frequency:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          source_type: Database["public"]["Enums"]["income_source_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          id?: string
          is_recurring?: boolean
          name: string
          notes?: string | null
          payment_method_id?: string | null
          recurring_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
          source_type?: Database["public"]["Enums"]["income_source_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          day_of_month?: number | null
          id?: string
          is_recurring?: boolean
          name?: string
          notes?: string | null
          payment_method_id?: string | null
          recurring_frequency?:
            | Database["public"]["Enums"]["recurring_frequency"]
            | null
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
      notifications: {
        Row: {
          created_at: string
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
      onboarding_state: {
        Row: {
          answers: Json
          current_step_index: number
          draft_entries: Json
          flow_version: number
          phase: Database["public"]["Enums"]["onboarding_phase"]
          plan_accepted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          current_step_index?: number
          draft_entries?: Json
          flow_version?: number
          phase?: Database["public"]["Enums"]["onboarding_phase"]
          plan_accepted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          current_step_index?: number
          draft_entries?: Json
          flow_version?: number
          phase?: Database["public"]["Enums"]["onboarding_phase"]
          plan_accepted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_survey_config: {
        Row: {
          config: Json
          id: string
          published: boolean
          updated_at: string
          version: number
        }
        Insert: {
          config?: Json
          id?: string
          published?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          config?: Json
          id?: string
          published?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          balance: number
          color: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
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
          balance?: number
          color?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
          balance?: number
          color?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
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
          default_shared_budget_plan_id: string | null
          display_name: string | null
          email: string | null
          financial_goals_notes: string
          food_frequency: string | null
          gender: string | null
          household: string | null
          id: string
          lifestyle_tier: string | null
          monthly_rent: number | null
          name: string
          no_debts_declared: boolean
          no_goals_declared: boolean
          onboarding_completed: boolean
          phone: string | null
          rent_includes_utilities: boolean
          secondary_currency:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode: string | null
          updated_at: string
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
          default_shared_budget_plan_id?: string | null
          display_name?: string | null
          email?: string | null
          financial_goals_notes?: string
          food_frequency?: string | null
          gender?: string | null
          household?: string | null
          id: string
          lifestyle_tier?: string | null
          monthly_rent?: number | null
          name?: string
          no_debts_declared?: boolean
          no_goals_declared?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          rent_includes_utilities?: boolean
          secondary_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode?: string | null
          updated_at?: string
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
          default_shared_budget_plan_id?: string | null
          display_name?: string | null
          email?: string | null
          financial_goals_notes?: string
          food_frequency?: string | null
          gender?: string | null
          household?: string | null
          id?: string
          lifestyle_tier?: string | null
          monthly_rent?: number | null
          name?: string
          no_debts_declared?: boolean
          no_goals_declared?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          rent_includes_utilities?: boolean
          secondary_currency?:
            | Database["public"]["Enums"]["currency_code"]
            | null
          transport_mode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_debt_payments: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          day_of_month: number | null
          debt_id: string
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
          category: Database["public"]["Enums"]["savings_category"]
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_balance: number
          icon: string | null
          id: string
          name: string
          notes: string | null
          opening_balance: number
          type: Database["public"]["Enums"]["savings_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["savings_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number
          type?: Database["public"]["Enums"]["savings_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["savings_category"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_balance?: number
          icon?: string | null
          id?: string
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
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          current_value: number | null
          id: string
          initial_amount: number | null
          notes: string | null
          purchase_date: string | null
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          asset_name?: string | null
          asset_symbol: string
          asset_type?: Database["public"]["Enums"]["savings_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_value?: number | null
          id?: string
          initial_amount?: number | null
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          asset_name?: string | null
          asset_symbol?: string
          asset_type?: Database["public"]["Enums"]["savings_type"]
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          current_value?: number | null
          id?: string
          initial_amount?: number | null
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
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
      savings_transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          kind: Database["public"]["Enums"]["savings_transaction_kind"]
          notes: string | null
          transaction_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          kind: Database["public"]["Enums"]["savings_transaction_kind"]
          notes?: string | null
          transaction_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          kind?: Database["public"]["Enums"]["savings_transaction_kind"]
          notes?: string | null
          transaction_date?: string
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
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: Database["public"]["Enums"]["subscription_billing_cycle"]
          billing_day: number
          brand_key: string | null
          cancelled_at: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          expense_category: Database["public"]["Enums"]["expense_category"]
          id: string
          linked_recurring_expense_id: string | null
          name: string
          next_billing_date: string | null
          notes: string | null
          payment_method_id: string | null
          plan_name: string | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_cycle?: Database["public"]["Enums"]["subscription_billing_cycle"]
          billing_day?: number
          brand_key?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          expense_category?: Database["public"]["Enums"]["expense_category"]
          id?: string
          linked_recurring_expense_id?: string | null
          name: string
          next_billing_date?: string | null
          notes?: string | null
          payment_method_id?: string | null
          plan_name?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["subscription_billing_cycle"]
          billing_day?: number
          brand_key?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          expense_category?: Database["public"]["Enums"]["expense_category"]
          id?: string
          linked_recurring_expense_id?: string | null
          name?: string
          next_billing_date?: string | null
          notes?: string | null
          payment_method_id?: string | null
          plan_name?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
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
      user_finance: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_provider: string
          budget_entry_mode: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout: Database["public"]["Enums"]["dashboard_layout"]
          dismiss_onboarding_banner: boolean
          enable_ai: boolean
          language: Database["public"]["Enums"]["locale_code"]
          month_start_day: number
          no_income_declared: boolean
          onboarding_banner_remind_at: string | null
          onboarding_checklist_hidden: boolean
          show_all_currencies_in_forms: boolean
          show_cents_in_dashboard: boolean
          show_secondary_currency: boolean
          theme: Database["public"]["Enums"]["theme_mode"]
          tutorial_current_step: string | null
          tutorials_completed: string[]
          two_factor_email_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_provider?: string
          budget_entry_mode?: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout?: Database["public"]["Enums"]["dashboard_layout"]
          dismiss_onboarding_banner?: boolean
          enable_ai?: boolean
          language?: Database["public"]["Enums"]["locale_code"]
          month_start_day?: number
          no_income_declared?: boolean
          onboarding_banner_remind_at?: string | null
          onboarding_checklist_hidden?: boolean
          show_all_currencies_in_forms?: boolean
          show_cents_in_dashboard?: boolean
          show_secondary_currency?: boolean
          theme?: Database["public"]["Enums"]["theme_mode"]
          tutorial_current_step?: string | null
          tutorials_completed?: string[]
          two_factor_email_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_provider?: string
          budget_entry_mode?: Database["public"]["Enums"]["budget_entry_mode"]
          dashboard_layout?: Database["public"]["Enums"]["dashboard_layout"]
          dismiss_onboarding_banner?: boolean
          enable_ai?: boolean
          language?: Database["public"]["Enums"]["locale_code"]
          month_start_day?: number
          no_income_declared?: boolean
          onboarding_banner_remind_at?: string | null
          onboarding_checklist_hidden?: boolean
          show_all_currencies_in_forms?: boolean
          show_cents_in_dashboard?: boolean
          show_secondary_currency?: boolean
          theme?: Database["public"]["Enums"]["theme_mode"]
          tutorial_current_step?: string | null
          tutorials_completed?: string[]
          two_factor_email_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
      add_subscription_with_recurring_expense: {
        Args: { p_recurring_expense: Json; p_subscription: Json }
        Returns: Json
      }
      api_rate_hit: {
        Args: { p_key: string; p_max_hits: number; p_window_seconds: number }
        Returns: boolean
      }
      backfill_from_user_finance: { Args: { p_user_id: string }; Returns: Json }
      cancel_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
      }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      check_email_status: { Args: { p_email: string }; Returns: Json }
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
      reactivate_subscription: {
        Args: { p_subscription_id: string }
        Returns: undefined
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
      goal_status: "active" | "paused" | "achieved"
      gold_karat: "18" | "21" | "22" | "24"
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
      onboarding_phase: "survey" | "buddgy"
      payment_method_type:
        | "cash"
        | "bank_transfer"
        | "card_debit"
        | "card_credit"
        | "nol"
        | "other"
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
      subscription_billing_cycle: "weekly" | "monthly" | "quarterly" | "yearly"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      ],
      goal_status: ["active", "paused", "achieved"],
      gold_karat: ["18", "21", "22", "24"],
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
      onboarding_phase: ["survey", "buddgy"],
      payment_method_type: [
        "cash",
        "bank_transfer",
        "card_debit",
        "card_credit",
        "nol",
        "other",
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
      ],
      subscription_billing_cycle: ["weekly", "monthly", "quarterly", "yearly"],
      subscription_status: ["active", "paused", "cancelled", "trial"],
      theme_mode: ["dark", "light"],
    },
  },
} as const
