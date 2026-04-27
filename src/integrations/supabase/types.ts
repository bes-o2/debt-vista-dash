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
      archived_companies: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string
          deleted_at: string
          deleted_by: string
          id: string
          industry: string | null
          name: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at: string
          created_by: string
          deleted_at?: string
          deleted_by: string
          id: string
          industry?: string | null
          name: string
          updated_at: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string
          deleted_by?: string
          id?: string
          industry?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_feedback: {
        Row: {
          analysis_area: string
          card_id: string
          card_title: string
          category: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          message: string
          metadata: Json
          status: string
          task_title: string
          updated_at: string
        }
        Insert: {
          analysis_area: string
          card_id: string
          card_title: string
          category?: string
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          message: string
          metadata?: Json
          status?: string
          task_title: string
          updated_at?: string
        }
        Update: {
          analysis_area?: string
          card_id?: string
          card_title?: string
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          metadata?: Json
          status?: string
          task_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          industry: string | null
          name: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          industry?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          industry?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      debt_guarantees: {
        Row: {
          company_id: string
          created_at: string
          debt_id: string
          description: string | null
          id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          company_id: string
          created_at?: string
          debt_id: string
          description?: string | null
          id?: string
          type: string
          updated_at?: string
          value?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          debt_id?: string
          description?: string | null
          id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "debt_guarantees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_guarantees_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_installments: {
        Row: {
          created_at: string
          debt_id: string
          due_date: string
          id: string
          installment_number: number
          interest_amount: number
          principal_amount: number
          remaining_balance: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          debt_id: string
          due_date: string
          id?: string
          installment_number: number
          interest_amount: number
          principal_amount: number
          remaining_balance: number
          total_amount: number
        }
        Update: {
          created_at?: string
          debt_id?: string
          due_date?: string
          id?: string
          installment_number?: number
          interest_amount?: number
          principal_amount?: number
          remaining_balance?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "debt_installments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          additional_fees: number | null
          bank: string | null
          calculation_table: string
          cet_annual_rate: number | null
          cet_monthly_rate: number | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          financed_amount: number
          first_due_date: string
          id: string
          indexer: string | null
          indexer_start_date: string | null
          interest_base: string
          interest_rate: number
          interest_type: string
          iof_rate: number | null
          last_due_date: string
          reprogramming_rules: Json | null
          spread_rate: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          additional_fees?: number | null
          bank?: string | null
          calculation_table: string
          cet_annual_rate?: number | null
          cet_monthly_rate?: number | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          financed_amount: number
          first_due_date: string
          id?: string
          indexer?: string | null
          indexer_start_date?: string | null
          interest_base: string
          interest_rate: number
          interest_type: string
          iof_rate?: number | null
          last_due_date: string
          reprogramming_rules?: Json | null
          spread_rate?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          additional_fees?: number | null
          bank?: string | null
          calculation_table?: string
          cet_annual_rate?: number | null
          cet_monthly_rate?: number | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          financed_amount?: number
          first_due_date?: string
          id?: string
          indexer?: string | null
          indexer_start_date?: string | null
          interest_base?: string
          interest_rate?: number
          interest_type?: string
          iof_rate?: number | null
          last_due_date?: string
          reprogramming_rules?: Json | null
          spread_rate?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      economic_indices: {
        Row: {
          created_at: string
          id: string
          index_type: string
          rate: number
          rate_type: string | null
          reference_date: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          index_type: string
          rate: number
          rate_type?: string | null
          reference_date: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          index_type?: string
          rate?: number
          rate_type?: string | null
          reference_date?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      index_projections: {
        Row: {
          annual_projection: number | null
          created_at: string
          created_by: string
          horizon_months: number
          id: string
          index_type: string
          monthly_projection: number | null
          projected_rate: number
          projection_date: string
          updated_at: string
        }
        Insert: {
          annual_projection?: number | null
          created_at?: string
          created_by: string
          horizon_months: number
          id?: string
          index_type: string
          monthly_projection?: number | null
          projected_rate: number
          projection_date: string
          updated_at?: string
        }
        Update: {
          annual_projection?: number | null
          created_at?: string
          created_by?: string
          horizon_months?: number
          id?: string
          index_type?: string
          monthly_projection?: number | null
          projected_rate?: number
          projection_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_company: { Args: { company_id: string }; Returns: undefined }
      calculate_annual_from_monthly: {
        Args: { monthly_rate: number }
        Returns: number
      }
      calculate_monthly_from_annual: {
        Args: { annual_rate: number }
        Returns: number
      }
      cleanup_old_archived_companies: { Args: never; Returns: number }
      debug_company_creation: {
        Args: { _name: string; _user_id: string }
        Returns: Json
      }
      get_auth_debug_info: { Args: never; Returns: Json }
      get_indexer_rate_for_date: {
        Args: { indexer_type: string; target_date: string }
        Returns: number
      }
      get_latest_indexer_rate: {
        Args: { indexer_type: string }
        Returns: number
      }
      is_company_owner: { Args: { _company_id: string }; Returns: boolean }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_company: {
        Args: { _company_id: string }
        Returns: boolean
      }
      user_can_create_company: {
        Args: { _created_by: string }
        Returns: boolean
      }
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
