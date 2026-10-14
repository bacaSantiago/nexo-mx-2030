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
      chat_message: {
        Row: {
          content: string
          created_at: string
          evidence: Json | null
          evidence_ids: string[]
          id: string
          intent: string | null
          latency_ms: number | null
          model: string | null
          params: Json | null
          role: string
          session_id: string
          validated: boolean | null
        }
        Insert: {
          content: string
          created_at?: string
          evidence?: Json | null
          evidence_ids?: string[]
          id?: string
          intent?: string | null
          latency_ms?: number | null
          model?: string | null
          params?: Json | null
          role: string
          session_id: string
          validated?: boolean | null
        }
        Update: {
          content?: string
          created_at?: string
          evidence?: Json | null
          evidence_ids?: string[]
          id?: string
          intent?: string | null
          latency_ms?: number | null
          model?: string | null
          params?: Json | null
          role?: string
          session_id?: string
          validated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_session"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_session: {
        Row: {
          active_filters: Json
          created_at: string
          id: string
          session_token_hash: string
          updated_at: string
        }
        Insert: {
          active_filters?: Json
          created_at?: string
          id?: string
          session_token_hash: string
          updated_at?: string
        }
        Update: {
          active_filters?: Json
          created_at?: string
          id?: string
          session_token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      dim_geography: {
        Row: {
          created_at: string
          geo_code: string
          geo_level: string
          geo_name: string
          id: string
          parent_geo_code: string | null
        }
        Insert: {
          created_at?: string
          geo_code: string
          geo_level: string
          geo_name: string
          id?: string
          parent_geo_code?: string | null
        }
        Update: {
          created_at?: string
          geo_code?: string
          geo_level?: string
          geo_name?: string
          id?: string
          parent_geo_code?: string | null
        }
        Relationships: []
      }
      dim_method: {
        Row: {
          created_at: string
          description: string
          id: string
          method_code: string
          method_label: string
          observed_or_modeled: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          method_code: string
          method_label: string
          observed_or_modeled: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          method_code?: string
          method_label?: string
          observed_or_modeled?: string
          updated_at?: string
        }
        Relationships: []
      }
      dim_metric: {
        Row: {
          created_at: string
          default_unit: string
          description: string | null
          higher_is_better: boolean | null
          id: string
          metric_code: string
          metric_label: string
          source_id: string | null
          status: string
          universe: string
          universe_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_unit: string
          description?: string | null
          higher_is_better?: boolean | null
          id?: string
          metric_code: string
          metric_label: string
          source_id?: string | null
          status?: string
          universe: string
          universe_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_unit?: string
          description?: string | null
          higher_is_better?: boolean | null
          id?: string
          metric_code?: string
          metric_label?: string
          source_id?: string | null
          status?: string
          universe?: string
          universe_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dim_metric_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      dim_segment: {
        Row: {
          created_at: string
          dimension: string
          id: string
          label: string
          segment_code: string
          value: string
        }
        Insert: {
          created_at?: string
          dimension: string
          id?: string
          label: string
          segment_code: string
          value: string
        }
        Update: {
          created_at?: string
          dimension?: string
          id?: string
          label?: string
          segment_code?: string
          value?: string
        }
        Relationships: []
      }
      fact_barrier: {
        Row: {
          barrier_code: string
          barrier_label: string
          ci_high: number | null
          ci_low: number | null
          created_at: string
          cv: number | null
          estimate: number
          fact_estimate_id: string | null
          geo_code: string
          geo_level: string
          id: string
          is_multiple_response: boolean
          method_id: string
          observed_or_modeled: string
          precision_flag: string
          reference_year: number
          segment_json: Json
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Insert: {
          barrier_code: string
          barrier_label: string
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate: number
          fact_estimate_id?: string | null
          geo_code?: string
          geo_level?: string
          id?: string
          is_multiple_response?: boolean
          method_id: string
          observed_or_modeled: string
          precision_flag?: string
          reference_year: number
          segment_json?: Json
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Update: {
          barrier_code?: string
          barrier_label?: string
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate?: number
          fact_estimate_id?: string | null
          geo_code?: string
          geo_level?: string
          id?: string
          is_multiple_response?: boolean
          method_id?: string
          observed_or_modeled?: string
          precision_flag?: string
          reference_year?: number
          segment_json?: Json
          source_id?: string
          unit?: string
          universe?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_barrier_fact_estimate_id_fkey"
            columns: ["fact_estimate_id"]
            isOneToOne: false
            referencedRelation: "fact_estimate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_barrier_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "dim_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_barrier_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_category: {
        Row: {
          category_code: string
          category_label: string
          ci_high: number | null
          ci_low: number | null
          created_at: string
          cv: number | null
          estimate: number
          fact_estimate_id: string | null
          geo_code: string
          geo_level: string
          id: string
          is_multiple_response: boolean
          method_id: string
          note: string | null
          observed_or_modeled: string
          precision_flag: string
          reference_year: number
          segment_json: Json
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Insert: {
          category_code: string
          category_label: string
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate: number
          fact_estimate_id?: string | null
          geo_code?: string
          geo_level?: string
          id?: string
          is_multiple_response?: boolean
          method_id: string
          note?: string | null
          observed_or_modeled: string
          precision_flag?: string
          reference_year: number
          segment_json?: Json
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Update: {
          category_code?: string
          category_label?: string
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate?: number
          fact_estimate_id?: string | null
          geo_code?: string
          geo_level?: string
          id?: string
          is_multiple_response?: boolean
          method_id?: string
          note?: string | null
          observed_or_modeled?: string
          precision_flag?: string
          reference_year?: number
          segment_json?: Json
          source_id?: string
          unit?: string
          universe?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_category_fact_estimate_id_fkey"
            columns: ["fact_estimate_id"]
            isOneToOne: false
            referencedRelation: "fact_estimate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_category_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "dim_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_category_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_estimate: {
        Row: {
          ci_high: number | null
          ci_low: number | null
          confidence_level: number | null
          created_at: string
          cv: number | null
          estimate: number
          geo_code: string
          geo_level: string
          id: string
          method_id: string
          metric_code: string
          note: string | null
          observed_or_modeled: string
          precision_flag: string
          reference_year: number
          segment_json: Json
          segment_key: string
          source_id: string
          source_page: string | null
          source_url: string | null
          standard_error: number | null
          unit: string
          universe: string
          updated_at: string
          version: string
        }
        Insert: {
          ci_high?: number | null
          ci_low?: number | null
          confidence_level?: number | null
          created_at?: string
          cv?: number | null
          estimate: number
          geo_code: string
          geo_level: string
          id?: string
          method_id: string
          metric_code: string
          note?: string | null
          observed_or_modeled: string
          precision_flag?: string
          reference_year: number
          segment_json?: Json
          segment_key?: string
          source_id: string
          source_page?: string | null
          source_url?: string | null
          standard_error?: number | null
          unit: string
          universe: string
          updated_at?: string
          version: string
        }
        Update: {
          ci_high?: number | null
          ci_low?: number | null
          confidence_level?: number | null
          created_at?: string
          cv?: number | null
          estimate?: number
          geo_code?: string
          geo_level?: string
          id?: string
          method_id?: string
          metric_code?: string
          note?: string | null
          observed_or_modeled?: string
          precision_flag?: string
          reference_year?: number
          segment_json?: Json
          segment_key?: string
          source_id?: string
          source_page?: string | null
          source_url?: string | null
          standard_error?: number | null
          unit?: string
          universe?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_estimate_geo_level_geo_code_fkey"
            columns: ["geo_level", "geo_code"]
            isOneToOne: false
            referencedRelation: "dim_geography"
            referencedColumns: ["geo_level", "geo_code"]
          },
          {
            foreignKeyName: "fact_estimate_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "dim_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_estimate_metric_code_fkey"
            columns: ["metric_code"]
            isOneToOne: false
            referencedRelation: "dim_metric"
            referencedColumns: ["metric_code"]
          },
          {
            foreignKeyName: "fact_estimate_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_problem: {
        Row: {
          ci_high: number | null
          ci_low: number | null
          created_at: string
          cv: number | null
          estimate: number
          geo_code: string
          geo_level: string
          id: string
          method_id: string
          observed_or_modeled: string
          precision_flag: string
          problem_code: string
          problem_label: string
          reference_year: number
          segment_json: Json
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Insert: {
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate: number
          geo_code?: string
          geo_level?: string
          id?: string
          method_id: string
          observed_or_modeled: string
          precision_flag?: string
          problem_code: string
          problem_label: string
          reference_year: number
          segment_json?: Json
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Update: {
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate?: number
          geo_code?: string
          geo_level?: string
          id?: string
          method_id?: string
          observed_or_modeled?: string
          precision_flag?: string
          problem_code?: string
          problem_label?: string
          reference_year?: number
          segment_json?: Json
          source_id?: string
          unit?: string
          universe?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_problem_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "dim_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_problem_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_supply: {
        Row: {
          ci_high: number | null
          ci_low: number | null
          created_at: string
          cv: number | null
          estimate: number
          geo_code: string
          geo_level: string
          id: string
          indicator_code: string
          indicator_label: string
          method_id: string
          observed_or_modeled: string
          precision_flag: string
          reference_year: number
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Insert: {
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate: number
          geo_code: string
          geo_level: string
          id?: string
          indicator_code: string
          indicator_label: string
          method_id: string
          observed_or_modeled: string
          precision_flag?: string
          reference_year: number
          source_id: string
          unit: string
          universe: string
          version: string
        }
        Update: {
          ci_high?: number | null
          ci_low?: number | null
          created_at?: string
          cv?: number | null
          estimate?: number
          geo_code?: string
          geo_level?: string
          id?: string
          indicator_code?: string
          indicator_label?: string
          method_id?: string
          observed_or_modeled?: string
          precision_flag?: string
          reference_year?: number
          source_id?: string
          unit?: string
          universe?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_supply_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "dim_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_supply_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention: {
        Row: {
          barrier_code: string
          created_at: string
          description: string
          evaluation_design: string | null
          id: string
          implementation_actors: string[]
          intervention_code: string
          intervention_name: string
          kpis: Json
          module_code: string | null
        }
        Insert: {
          barrier_code: string
          created_at?: string
          description: string
          evaluation_design?: string | null
          id?: string
          implementation_actors?: string[]
          intervention_code: string
          intervention_name: string
          kpis?: Json
          module_code?: string | null
        }
        Update: {
          barrier_code?: string
          created_at?: string
          description?: string
          evaluation_design?: string | null
          id?: string
          implementation_actors?: string[]
          intervention_code?: string
          intervention_name?: string
          kpis?: Json
          module_code?: string | null
        }
        Relationships: []
      }
      intervention_score: {
        Row: {
          created_at: string
          equity: number | null
          feasibility: number | null
          geo_code: string
          geo_level: string
          id: string
          intervention_code: string
          model_version: string
          modeled_uplift: number | null
          observed_or_modeled: string
          priority_score: number | null
          reach: number | null
          relative_cost: number | null
          segment_code: string | null
        }
        Insert: {
          created_at?: string
          equity?: number | null
          feasibility?: number | null
          geo_code: string
          geo_level: string
          id?: string
          intervention_code: string
          model_version: string
          modeled_uplift?: number | null
          observed_or_modeled?: string
          priority_score?: number | null
          reach?: number | null
          relative_cost?: number | null
          segment_code?: string | null
        }
        Update: {
          created_at?: string
          equity?: number | null
          feasibility?: number | null
          geo_code?: string
          geo_level?: string
          id?: string
          intervention_code?: string
          model_version?: string
          modeled_uplift?: number | null
          observed_or_modeled?: string
          priority_score?: number | null
          reach?: number | null
          relative_cost?: number | null
          segment_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_score_intervention_code_fkey"
            columns: ["intervention_code"]
            isOneToOne: false
            referencedRelation: "intervention"
            referencedColumns: ["intervention_code"]
          },
        ]
      }
      methodology_note: {
        Row: {
          body: string
          created_at: string
          id: string
          note_code: string
          source_id: string | null
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          note_code: string
          source_id?: string | null
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          note_code?: string
          source_id?: string | null
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_note_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_definition: {
        Row: {
          assumptions: Json
          created_at: string
          description: string
          id: string
          is_active: boolean
          scenario_code: string
          scenario_name: string
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          scenario_code: string
          scenario_name: string
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          scenario_code?: string
          scenario_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      scenario_result: {
        Row: {
          assumption_values: Json
          assumptions_version: string
          component_code: string
          created_at: string
          estimate: number
          geo_code: string
          geo_level: string
          id: string
          metric_code: string
          observed_or_modeled: string
          p10: number | null
          p50: number | null
          p90: number | null
          reference_year: number
          scenario_code: string
          segment_code: string
          unit: string
        }
        Insert: {
          assumption_values?: Json
          assumptions_version: string
          component_code?: string
          created_at?: string
          estimate: number
          geo_code: string
          geo_level: string
          id?: string
          metric_code: string
          observed_or_modeled?: string
          p10?: number | null
          p50?: number | null
          p90?: number | null
          reference_year: number
          scenario_code: string
          segment_code?: string
          unit: string
        }
        Update: {
          assumption_values?: Json
          assumptions_version?: string
          component_code?: string
          created_at?: string
          estimate?: number
          geo_code?: string
          geo_level?: string
          id?: string
          metric_code?: string
          observed_or_modeled?: string
          p10?: number | null
          p50?: number | null
          p90?: number | null
          reference_year?: number
          scenario_code?: string
          segment_code?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_result_metric_code_fkey"
            columns: ["metric_code"]
            isOneToOne: false
            referencedRelation: "dim_metric"
            referencedColumns: ["metric_code"]
          },
          {
            foreignKeyName: "scenario_result_scenario_code_fkey"
            columns: ["scenario_code"]
            isOneToOne: false
            referencedRelation: "scenario_definition"
            referencedColumns: ["scenario_code"]
          },
        ]
      }
      source_chunk: {
        Row: {
          chunk_text: string
          created_at: string
          document_id: string
          id: string
          metadata: Json
          page_label: string | null
        }
        Insert: {
          chunk_text: string
          created_at?: string
          document_id: string
          id?: string
          metadata?: Json
          page_label?: string | null
        }
        Update: {
          chunk_text?: string
          created_at?: string
          document_id?: string
          id?: string
          metadata?: Json
          page_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_chunk_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
      source_document: {
        Row: {
          bundle_status: string | null
          created_at: string
          edition: string | null
          geographic_coverage: string | null
          id: string
          institution: string | null
          modules_used: string[]
          notes: string | null
          official_url: string
          purpose: string | null
          resource_type: string | null
          retrieved_at: string | null
          sha256: string | null
          source_code: string
          source_name: string
          status: string
          tier: string | null
          title: string
          universe_description: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          bundle_status?: string | null
          created_at?: string
          edition?: string | null
          geographic_coverage?: string | null
          id?: string
          institution?: string | null
          modules_used?: string[]
          notes?: string | null
          official_url: string
          purpose?: string | null
          resource_type?: string | null
          retrieved_at?: string | null
          sha256?: string | null
          source_code: string
          source_name: string
          status?: string
          tier?: string | null
          title: string
          universe_description?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          bundle_status?: string | null
          created_at?: string
          edition?: string | null
          geographic_coverage?: string | null
          id?: string
          institution?: string | null
          modules_used?: string[]
          notes?: string | null
          official_url?: string
          purpose?: string | null
          resource_type?: string | null
          retrieved_at?: string | null
          sha256?: string | null
          source_code?: string
          source_name?: string
          status?: string
          tier?: string | null
          title?: string
          universe_description?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      source_lineage: {
        Row: {
          created_at: string
          fact_id: string
          fact_table: string
          id: string
          loaded_version: string
          source_id: string
          source_page: string | null
          source_url: string | null
          transformation: string
        }
        Insert: {
          created_at?: string
          fact_id: string
          fact_table: string
          id?: string
          loaded_version: string
          source_id: string
          source_page?: string | null
          source_url?: string | null
          transformation: string
        }
        Update: {
          created_at?: string
          fact_id?: string
          fact_table?: string
          id?: string
          loaded_version?: string
          source_id?: string
          source_page?: string | null
          source_url?: string | null
          transformation?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_lineage_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "source_document"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      request_session_token_hash: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const
