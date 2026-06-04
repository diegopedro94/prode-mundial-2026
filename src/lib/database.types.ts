export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          is_admin: boolean
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          is_admin?: boolean
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          is_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "allowed_emails_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          id: number
          is_own_goal: boolean
          is_penalty: boolean
          match_id: number
          minute: number | null
          player_id: number
          team_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          is_own_goal?: boolean
          is_penalty?: boolean
          match_id: number
          minute?: number | null
          player_id: number
          team_id: number
        }
        Update: {
          created_at?: string
          id?: number
          is_own_goal?: boolean
          is_penalty?: boolean
          match_id?: number
          minute?: number | null
          player_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team_id: number | null
          external_id: number | null
          group_letter: string | null
          home_score: number | null
          home_team_id: number | null
          id: number
          pk_winner_team_id: number | null
          scheduled_at: string
          stage: Database["public"]["Enums"]["tournament_stage"]
          status: Database["public"]["Enums"]["match_status"]
          summary_intro: string | null
          updated_at: string | null
          went_to_penalties: boolean
          winner_team_id: number | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: number | null
          external_id?: number | null
          group_letter?: string | null
          home_score?: number | null
          home_team_id?: number | null
          id?: number
          pk_winner_team_id?: number | null
          scheduled_at: string
          stage: Database["public"]["Enums"]["tournament_stage"]
          status?: Database["public"]["Enums"]["match_status"]
          summary_intro?: string | null
          updated_at?: string | null
          went_to_penalties?: boolean
          winner_team_id?: number | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: number | null
          external_id?: number | null
          group_letter?: string | null
          home_score?: number | null
          home_team_id?: number | null
          id?: number
          pk_winner_team_id?: number | null
          scheduled_at?: string
          stage?: Database["public"]["Enums"]["tournament_stage"]
          status?: Database["public"]["Enums"]["match_status"]
          summary_intro?: string | null
          updated_at?: string | null
          went_to_penalties?: boolean
          winner_team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_pk_winner_team_id_fkey"
            columns: ["pk_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          external_id: number | null
          firstname: string | null
          id: number
          is_in_official_roster: boolean
          jersey_number: number | null
          lastname: string | null
          name: string
          position: Database["public"]["Enums"]["player_position"] | null
          team_id: number
        }
        Insert: {
          external_id?: number | null
          firstname?: string | null
          id?: number
          is_in_official_roster?: boolean
          jersey_number?: number | null
          lastname?: string | null
          name: string
          position?: Database["public"]["Enums"]["player_position"] | null
          team_id: number
        }
        Update: {
          external_id?: number | null
          firstname?: string | null
          id?: number
          is_in_official_roster?: boolean
          jersey_number?: number | null
          lastname?: string | null
          name?: string
          position?: Database["public"]["Enums"]["player_position"] | null
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          away_score: number
          home_score: number
          match_id: number
          pk_winner_team_id: number | null
          points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          away_score: number
          home_score: number
          match_id: number
          pk_winner_team_id?: number | null
          points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          away_score?: number
          home_score?: number
          match_id?: number
          pk_winner_team_id?: number | null
          points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_pk_winner_team_id_fkey"
            columns: ["pk_winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          is_admin?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      rounds: {
        Row: {
          locks_at: string
          stage: Database["public"]["Enums"]["tournament_stage"]
        }
        Insert: {
          locks_at: string
          stage: Database["public"]["Enums"]["tournament_stage"]
        }
        Update: {
          locks_at?: string
          stage?: Database["public"]["Enums"]["tournament_stage"]
        }
        Relationships: []
      }
      special_predictions: {
        Row: {
          best_gk_player_id: number | null
          champion_team_id: number | null
          mvp_player_id: number | null
          points: number
          runner_up_team_id: number | null
          top_scorer_player_id: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          best_gk_player_id?: number | null
          champion_team_id?: number | null
          mvp_player_id?: number | null
          points?: number
          runner_up_team_id?: number | null
          top_scorer_player_id?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          best_gk_player_id?: number | null
          champion_team_id?: number | null
          mvp_player_id?: number | null
          points?: number
          runner_up_team_id?: number | null
          top_scorer_player_id?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_predictions_best_gk_player_id_fkey"
            columns: ["best_gk_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_predictions_champion_team_id_fkey"
            columns: ["champion_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_predictions_mvp_player_id_fkey"
            columns: ["mvp_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_predictions_runner_up_team_id_fkey"
            columns: ["runner_up_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_predictions_top_scorer_player_id_fkey"
            columns: ["top_scorer_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          error_message: string | null
          finished_at: string | null
          fixtures_processed: number
          fixtures_updated: number
          id: number
          requests_remaining: number | null
          started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          fixtures_processed?: number
          fixtures_updated?: number
          id?: number
          requests_remaining?: number | null
          started_at?: string
          status: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          fixtures_processed?: number
          fixtures_updated?: number
          id?: number
          requests_remaining?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          external_id: number | null
          fifa_code: string
          flag_url: string | null
          group_letter: string | null
          id: number
          name: string
        }
        Insert: {
          external_id?: number | null
          fifa_code: string
          flag_url?: string | null
          group_letter?: string | null
          id?: number
          name: string
        }
        Update: {
          external_id?: number | null
          fifa_code?: string
          flag_url?: string | null
          group_letter?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_match_points: {
        Args: {
          p: unknown
          m: unknown
        }
        Returns: number
      }
      get_leaderboard: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          display_name: string
          avatar_url: string
          total_points: number
          exact_count: number
          scored_count: number
          predictions_count: number
        }[]
      }
      get_top_scorers: {
        Args: {
          limit_count?: number
        }
        Returns: {
          player_id: number
          player_name: string
          player_position: Database["public"]["Enums"]["player_position"]
          team_id: number
          team_name: string
          team_fifa_code: string
          team_flag_url: string
          goals_count: number
          is_in_official_roster: boolean
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      match_status: "scheduled" | "live" | "finished"
      player_position: "GK" | "DEF" | "MID" | "FWD"
      tournament_stage:
        | "group"
        | "r32"
        | "r16"
        | "qf"
        | "sf"
        | "third_place"
        | "final"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

