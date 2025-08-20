export type Tournament = {
  id: string
  name: string
  description?: string | null
  format?: 'BP' | 'AP'
  created_at?: string
}

export type Team = {
  id: string
  name: string
  institution?: string | null
  tournament_id: string
}

export type Round = {
  id: string
  round_number: number
  gov_team_id: string
  opp_team_id: string
  room?: string | null
  tournament_id: string
  motion?: string | null
}

export type Member = {
  id: string
  user_id: string
  team_id: string
  role: 'leader' | 'member' | 'substitute'
  created_at?: string
}

export type Speaker = {
  id: string
  name: string
  team_id: string
  speaker_order?: number
  created_at?: string
}

export type Standing = {
  id: string
  team_id: string
  wins: number
  total_score: number
  tournament_id: string
}
