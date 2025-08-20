// Enhanced database types to match the new Tabbycat-like schema
// Import the comprehensive types from database.ts for new features

export type Tournament = {
  id: string
  name: string
  short_name?: string | null
  slug: string
  description?: string | null
  format?: 'BP' | 'AP' | '2vs2'
  active?: boolean
  current_round_id?: string | null
  preferences?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export type Institution = {
  id: string
  name: string
  code: string
  region_id?: string | null
  url?: string | null
  created_at?: string
}

export type Team = {
  id: string
  tournament_id: string
  institution_id?: string | null
  reference: string
  short_reference?: string | null
  code_name?: string | null
  short_name?: string | null
  long_name?: string | null
  team_type?: 'normal' | 'swing' | 'composite' | 'bye'
  seed?: number | null
  emoji?: string | null
  created_at?: string
}

export type Speaker = {
  id: string
  name: string
  team_id: string
  email?: string | null
  phone?: string | null
  gender?: 'M' | 'F' | 'O' | null
  pronouns?: string | null
  anonymous?: boolean
  code_name?: string | null
  speaker_order?: number | null
  created_at?: string
}

export type Adjudicator = {
  id: string
  tournament_id: string
  user_id: string
  institution_id?: string | null
  name: string
  email?: string | null
  base_score?: number
  trainee?: boolean
  breaking?: boolean
  independent?: boolean
  adj_core?: boolean
  created_at?: string
}

export type Round = {
  id: string
  tournament_id: string
  seq: number
  name: string
  abbreviation?: string | null
  completed?: boolean
  stage?: 'preliminary' | 'elimination'
  draw_type?: 'random' | 'manual' | 'round_robin' | 'power_paired' | 'elimination' | 'seeded'
  draw_status?: 'none' | 'draft' | 'confirmed' | 'released'
  starts_at?: string | null
  created_at?: string
}

export type Debate = {
  id: string
  round_id: string
  venue_id?: string | null
  bracket?: number
  room_rank?: number
  importance?: number
  result_status?: 'none' | 'postponed' | 'draft' | 'confirmed'
  sides_confirmed?: boolean
  created_at?: string
}

export type DebateTeam = {
  id: string
  debate_id: string
  team_id: string
  side: number  // 0=OG, 1=OO, 2=CG, 3=CO (BP) or 0=AFF, 1=NEG (AP)
  created_at?: string
}

export type Motion = {
  id: string
  round_id: string
  seq?: number
  text: string
  info_slide?: string | null
  reference?: string | null
  created_at?: string
}

export type Venue = {
  id: string
  tournament_id: string
  name: string
  display_name?: string | null
  priority?: number
  external_url?: string | null
  created_at?: string
}

// Legacy types for backward compatibility
export type Member = {
  id: string
  user_id: string
  team_id: string
  role: 'leader' | 'member' | 'substitute'
  total_points?: number
  average_points?: number
  rounds_participated?: number
  created_at?: string
}

export type SpeakerScore = {
  id: string
  member_id: string
  match_id: string
  round_id: string
  points: number
  created_at?: string
}

export type Result = {
  id: string
  match_id: string
  team_id: string
  round_id?: string | null
  points: number
  rank: number
  created_at?: string
}

export type SpeakerStanding = {
  id: string
  member_id: string
  speaker_name: string | null
  team_name: string
  institution: string | null
  total_points: number
  average_points: number
  rounds_participated: number
  tournament_id: string
  standard_deviation: number
  round_scores: number[] | null
}

export type Standing = {
  id: string
  team_id: string
  wins: number
  total_score: number
  tournament_id: string
}

// New Tabbycat-like types
export type TeamStanding = {
  team_id: string
  team_name: string
  institution_name: string | null
  wins: number
  total_speaker_score: number
  average_speaker_score: number
  total_margin: number
  draw_strength: number
}

export type SpeakerStandingNew = {
  speaker_id: string
  speaker_name: string
  team_name: string
  institution_name: string | null
  total_score: number
  average_score: number
  speeches_count: number
  standard_deviation: number
}

export type TournamentState = {
  tournament: {
    id: string
    name: string
    slug: string
    current_round: number | null
    active: boolean
    preferences: Record<string, any>
  }
  teams_count: number
  adjudicators_count: number
  rounds_count: number
  completed_rounds: number
}

// Side mappings
export const SIDE_NAMES = {
  BP: ['OG', 'OO', 'CG', 'CO'],
  AP: ['Government', 'Opposition'],
  '2vs2': ['Affirmative', 'Negative']
} as const

export type SideName = typeof SIDE_NAMES[keyof typeof SIDE_NAMES][number]
