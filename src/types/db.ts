export type Tournament = {
  id: string
  name: string
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
}

export type Standing = {
  id: string
  team_id: string
  wins: number
  total_score: number
  tournament_id: string
}
