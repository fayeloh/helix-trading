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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          base_currency: string
          broker: string | null
          created_at: string
          id: string
          is_archived: boolean
          name: string
          notes: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          broker?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          notes?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          broker?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          notes?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefings: {
        Row: {
          account_id: string | null
          briefing_date: string
          briefing_type: string
          generated_at: string
          holdings_hash: string | null
          id: string
          lang: string
          model: string | null
          payload: Json
          user_id: string
        }
        Insert: {
          account_id?: string | null
          briefing_date?: string
          briefing_type: string
          generated_at?: string
          holdings_hash?: string | null
          id?: string
          lang?: string
          model?: string | null
          payload: Json
          user_id: string
        }
        Update: {
          account_id?: string | null
          briefing_date?: string
          briefing_type?: string
          generated_at?: string
          holdings_hash?: string | null
          id?: string
          lang?: string
          model?: string | null
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          items: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          items?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          items?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_impacts: {
        Row: {
          account_id: string | null
          baseline: Json
          created_at: string
          direction: string
          event_kind: string
          id: string
          impact_targets: Json
          note: string | null
          published_at: string | null
          recorded_at: string
          source: string | null
          source_briefing_id: string | null
          symbols: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          baseline?: Json
          created_at?: string
          direction?: string
          event_kind?: string
          id?: string
          impact_targets?: Json
          note?: string | null
          published_at?: string | null
          recorded_at?: string
          source?: string | null
          source_briefing_id?: string | null
          symbols?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          baseline?: Json
          created_at?: string
          direction?: string
          event_kind?: string
          id?: string
          impact_targets?: Json
          note?: string | null
          published_at?: string | null
          recorded_at?: string
          source?: string | null
          source_briefing_id?: string | null
          symbols?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_impacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_impacts_source_briefing_id_fkey"
            columns: ["source_briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          account_id: string
          avg_cost: number
          created_at: string
          currency: string
          display_name: string | null
          id: string
          industry_tags: string[]
          market: string
          notes: string | null
          quantity: number
          sector: string | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          avg_cost?: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          industry_tags?: string[]
          market?: string
          notes?: string | null
          quantity?: number
          sector?: string | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          avg_cost?: number
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          industry_tags?: string[]
          market?: string
          notes?: string | null
          quantity?: number
          sector?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          account_id: string | null
          checklist: Json
          closed_at: string | null
          created_at: string
          direction: string
          discipline_score: number | null
          emotion: string | null
          entry_reason: string | null
          exit_reason: string | null
          id: string
          market: string
          max_position_pct: number | null
          opened_at: string
          outcome_pct: number | null
          planned_stop: number | null
          planned_target: number | null
          review_notes: string | null
          status: string
          symbol: string
          thesis: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          checklist?: Json
          closed_at?: string | null
          created_at?: string
          direction?: string
          discipline_score?: number | null
          emotion?: string | null
          entry_reason?: string | null
          exit_reason?: string | null
          id?: string
          market?: string
          max_position_pct?: number | null
          opened_at?: string
          outcome_pct?: number | null
          planned_stop?: number | null
          planned_target?: number | null
          review_notes?: string | null
          status?: string
          symbol: string
          thesis?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          checklist?: Json
          closed_at?: string | null
          created_at?: string
          direction?: string
          discipline_score?: number | null
          emotion?: string | null
          entry_reason?: string | null
          exit_reason?: string | null
          id?: string
          market?: string
          max_position_pct?: number | null
          opened_at?: string
          outcome_pct?: number | null
          planned_stop?: number | null
          planned_target?: number | null
          review_notes?: string | null
          status?: string
          symbol?: string
          thesis?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      market_cache: {
        Row: {
          cache_key: string
          expires_at: string
          fetched_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          expires_at?: string
          fetched_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          payload?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          display_timezone: string
          id: string
          lang: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          display_timezone?: string
          id: string
          lang?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          display_timezone?: string
          id?: string
          lang?: string
          updated_at?: string
        }
        Relationships: []
      }
      research_reports: {
        Row: {
          expires_at: string
          generated_at: string
          id: string
          lang: string
          lookback_days: number | null
          market: string
          model: string | null
          payload: Json
          section: string
          symbol: string
          user_id: string
        }
        Insert: {
          expires_at?: string
          generated_at?: string
          id?: string
          lang?: string
          lookback_days?: number | null
          market?: string
          model?: string | null
          payload: Json
          section: string
          symbol: string
          user_id: string
        }
        Update: {
          expires_at?: string
          generated_at?: string
          id?: string
          lang?: string
          lookback_days?: number | null
          market?: string
          model?: string | null
          payload?: Json
          section?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      risk_rules: {
        Row: {
          account_id: string | null
          created_at: string
          default_stop_pct: number
          id: string
          max_open_positions: number
          max_position_pct: number
          max_sector_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          default_stop_pct?: number
          id?: string
          max_open_positions?: number
          max_position_pct?: number
          max_sector_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          default_stop_pct?: number
          id?: string
          max_open_positions?: number
          max_position_pct?: number
          max_sector_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          created_at: string
          currency: string
          emotion: string | null
          fees: number
          id: string
          journal_entry_id: string | null
          market: string
          price: number
          quantity: number
          reason: string | null
          side: string
          symbol: string
          trade_date: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          currency?: string
          emotion?: string | null
          fees?: number
          id?: string
          journal_entry_id?: string | null
          market?: string
          price: number
          quantity: number
          reason?: string | null
          side?: string
          symbol: string
          trade_date?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          currency?: string
          emotion?: string | null
          fees?: number
          id?: string
          journal_entry_id?: string | null
          market?: string
          price?: number
          quantity?: number
          reason?: string | null
          side?: string
          symbol?: string
          trade_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_indexes: {
        Row: {
          created_at: string
          group: string
          id: string
          label: string
          sort_order: number
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group?: string
          id?: string
          label: string
          sort_order?: number
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          group?: string
          id?: string
          label?: string
          sort_order?: number
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
