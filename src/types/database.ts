// Generated database types for Supabase - Tabbycat-like schema

export interface Database {
  public: {
    Tables: {
      regions: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string | null
        }
      }
      institutions: {
        Row: {
          id: string
          name: string
          code: string
          region_id: string | null
          url: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          code: string
          region_id?: string | null
          url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          code?: string
          region_id?: string | null
          url?: string | null
          created_at?: string | null
        }
      }
      tournaments: {
        Row: {
          id: string
          name: string
          short_name: string | null
          slug: string
          description: string | null
          format: 'BP' | 'AP' | '2vs2'
          created_by: string | null
          active: boolean
          current_round_id: string | null
          preferences: Record<string, any>
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          short_name?: string | null
          slug: string
          description?: string | null
          format?: 'BP' | 'AP' | '2vs2'
          created_by?: string | null
          active?: boolean
          current_round_id?: string | null
          preferences?: Record<string, any>
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          short_name?: string | null
          slug?: string
          description?: string | null
          format?: 'BP' | 'AP' | '2vs2'
          created_by?: string | null
          active?: boolean
          current_round_id?: string | null
          preferences?: Record<string, any>
          created_at?: string | null
          updated_at?: string | null
        }
      }
      teams: {
        Row: {
          id: string
          tournament_id: string
          institution_id: string | null
          reference: string
          short_reference: string | null
          code_name: string | null
          seed: number | null
          emoji: string | null
          short_name: string | null
          long_name: string | null
          team_type: 'normal' | 'swing' | 'composite' | 'bye'
          use_institution_prefix: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          institution_id?: string | null
          reference: string
          short_reference?: string | null
          code_name?: string | null
          seed?: number | null
          emoji?: string | null
          team_type?: 'normal' | 'swing' | 'composite' | 'bye'
          use_institution_prefix?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          institution_id?: string | null
          reference?: string
          short_reference?: string | null
          code_name?: string | null
          seed?: number | null
          emoji?: string | null
          team_type?: 'normal' | 'swing' | 'composite' | 'bye'
          use_institution_prefix?: boolean
          created_at?: string | null
        }
      }
      speakers: {
        Row: {
          id: string
          name: string
          team_id: string
          email: string | null
          phone: string | null
          gender: 'M' | 'F' | 'O' | null
          pronouns: string | null
          anonymous: boolean
          code_name: string | null
          url_key: string | null
          speaker_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          team_id: string
          email?: string | null
          phone?: string | null
          gender?: 'M' | 'F' | 'O' | null
          pronouns?: string | null
          anonymous?: boolean
          code_name?: string | null
          url_key?: string | null
          speaker_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          team_id?: string
          email?: string | null
          phone?: string | null
          gender?: 'M' | 'F' | 'O' | null
          pronouns?: string | null
          anonymous?: boolean
          code_name?: string | null
          url_key?: string | null
          speaker_order?: number | null
          created_at?: string | null
        }
      }
      adjudicators: {
        Row: {
          id: string
          tournament_id: string
          user_id: string
          institution_id: string | null
          name: string
          email: string | null
          phone: string | null
          gender: 'M' | 'F' | 'O' | null
          pronouns: string | null
          anonymous: boolean
          code_name: string | null
          url_key: string | null
          base_score: number
          trainee: boolean
          breaking: boolean
          independent: boolean
          adj_core: boolean
          test_score: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          user_id: string
          institution_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          gender?: 'M' | 'F' | 'O' | null
          pronouns?: string | null
          anonymous?: boolean
          code_name?: string | null
          url_key?: string | null
          base_score?: number
          trainee?: boolean
          breaking?: boolean
          independent?: boolean
          adj_core?: boolean
          test_score?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          user_id?: string
          institution_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          gender?: 'M' | 'F' | 'O' | null
          pronouns?: string | null
          anonymous?: boolean
          code_name?: string | null
          url_key?: string | null
          base_score?: number
          trainee?: boolean
          breaking?: boolean
          independent?: boolean
          adj_core?: boolean
          test_score?: number | null
          created_at?: string | null
        }
      }
      venues: {
        Row: {
          id: string
          tournament_id: string
          name: string
          display_name: string | null
          priority: number
          external_url: string | null
          categories: Record<string, any>
          created_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          display_name?: string | null
          priority?: number
          external_url?: string | null
          categories?: Record<string, any>
          created_at?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          display_name?: string | null
          priority?: number
          external_url?: string | null
          categories?: Record<string, any>
          created_at?: string | null
        }
      }
      rounds: {
        Row: {
          id: string
          tournament_id: string
          seq: number
          name: string
          abbreviation: string | null
          completed: boolean
          stage: 'preliminary' | 'elimination'
          draw_type: 'random' | 'manual' | 'round_robin' | 'power_paired' | 'elimination' | 'seeded'
          draw_status: 'none' | 'draft' | 'confirmed' | 'released'
          break_category_id: string | null
          starts_at: string | null
          feedback_weight: number
          silent: boolean
          motions_released: boolean
          weight: number
          created_at: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          seq: number
          name: string
          abbreviation?: string | null
          completed?: boolean
          stage?: 'preliminary' | 'elimination'
          draw_type?: 'random' | 'manual' | 'round_robin' | 'power_paired' | 'elimination' | 'seeded'
          draw_status?: 'none' | 'draft' | 'confirmed' | 'released'
          break_category_id?: string | null
          starts_at?: string | null
          feedback_weight?: number
          silent?: boolean
          motions_released?: boolean
          weight?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          seq?: number
          name?: string
          abbreviation?: string | null
          completed?: boolean
          stage?: 'preliminary' | 'elimination'
          draw_type?: 'random' | 'manual' | 'round_robin' | 'power_paired' | 'elimination' | 'seeded'
          draw_status?: 'none' | 'draft' | 'confirmed' | 'released'
          break_category_id?: string | null
          starts_at?: string | null
          feedback_weight?: number
          silent?: boolean
          motions_released?: boolean
          weight?: number
          created_at?: string | null
        }
      }
      debates: {
        Row: {
          id: string
          round_id: string
          venue_id: string | null
          bracket: number
          room_rank: number
          importance: number
          result_status: 'none' | 'postponed' | 'draft' | 'confirmed'
          sides_confirmed: boolean
          flags: Record<string, any>
          created_at: string | null
        }
        Insert: {
          id?: string
          round_id: string
          venue_id?: string | null
          bracket?: number
          room_rank?: number
          importance?: number
          result_status?: 'none' | 'postponed' | 'draft' | 'confirmed'
          sides_confirmed?: boolean
          flags?: Record<string, any>
          created_at?: string | null
        }
        Update: {
          id?: string
          round_id?: string
          venue_id?: string | null
          bracket?: number
          room_rank?: number
          importance?: number
          result_status?: 'none' | 'postponed' | 'draft' | 'confirmed'
          sides_confirmed?: boolean
          flags?: Record<string, any>
          created_at?: string | null
        }
      }
      debate_teams: {
        Row: {
          id: string
          debate_id: string
          team_id: string
          side: number
          created_at: string | null
        }
        Insert: {
          id?: string
          debate_id: string
          team_id: string
          side: number
          created_at?: string | null
        }
        Update: {
          id?: string
          debate_id?: string
          team_id?: string
          side?: number
          created_at?: string | null
        }
      }
      motions: {
        Row: {
          id: string
          round_id: string
          seq: number
          text: string
          info_slide: string | null
          reference: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          round_id: string
          seq?: number
          text: string
          info_slide?: string | null
          reference?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          round_id?: string
          seq?: number
          text?: string
          info_slide?: string | null
          reference?: string | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_team_standings: {
        Args: { tournament_uuid: string }
        Returns: Array<{
          team_id: string
          team_name: string
          institution_name: string
          wins: number
          total_speaker_score: number
          average_speaker_score: number
          total_margin: number
          draw_strength: number
        }>
      }
      calculate_speaker_standings: {
        Args: { tournament_uuid: string }
        Returns: Array<{
          speaker_id: string
          speaker_name: string
          team_name: string
          institution_name: string
          total_score: number
          average_score: number
          speeches_count: number
          standard_deviation: number
        }>
      }
      get_tournament_state: {
        Args: { tournament_uuid: string }
        Returns: Record<string, any>
      }
      create_sample_tournament: {
        Args: {}
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type Tournament = Database['public']['Tables']['tournaments']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Speaker = Database['public']['Tables']['speakers']['Row']
export type Adjudicator = Database['public']['Tables']['adjudicators']['Row']
export type Round = Database['public']['Tables']['rounds']['Row']
export type Debate = Database['public']['Tables']['debates']['Row']
export type Motion = Database['public']['Tables']['motions']['Row']
export type Venue = Database['public']['Tables']['venues']['Row']
export type Institution = Database['public']['Tables']['institutions']['Row']

// Tournament preferences type
export interface TournamentPreferences {
  teams_in_debate: number
  speakers_in_team: number
  substantive_speakers: number
  reply_scores_enabled: boolean
  min_speaker_score: number
  max_speaker_score: number
  speaker_score_step: number
  team_points_win: number
  team_points_loss: number
  draw_side_allocations: string
  public_results: boolean
  public_draw: boolean
  public_standings: boolean
  enable_checkins: boolean
  enable_motions: boolean
  enable_venue_constraints: boolean
}

// Side mappings for different formats
export const SIDE_NAMES = {
  BP: ['OG', 'OO', 'CG', 'CO'],
  AP: ['Government', 'Opposition'],
  '2vs2': ['Affirmative', 'Negative']
} as const

export type SideName = typeof SIDE_NAMES[keyof typeof SIDE_NAMES][number]
