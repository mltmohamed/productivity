export type Difficulty = 'facile' | 'moyen' | 'difficile'
export type QuestType = 'daily' | 'normal'

export type Project = {
  id: number
  name: string
  description: string
  level: number
  xp: number
  created_at: string
  updated_at: string
}

export type Quest = {
  id: number
  project_id: number
  title: string
  description: string
  difficulty: Difficulty
  xp: number
  type: QuestType
  completed: number
  completed_at: string | null
  last_reset_date: string | null
  position: number
  created_at: string
  updated_at: string
}

export type Stats = {
  id: number
  total_xp: number
  completed_tasks: number
  streak: number
  last_active_date: string | null
  penalty_xp: number
}

export type AppSettings = {
  id: number
  user_name: string
  access_code: string
  currency: string
  monthly_budget: number
  sound_enabled: number
  updated_at: string
}

export type FinanceTransaction = {
  id: number
  type: 'income' | 'expense'
  title: string
  category: string
  amount: number
  tx_date: string
  note: string
  created_at: string
}

export type AppState = {
  projects: Project[]
  quests: Quest[]
  stats: Stats
  settings: AppSettings
  transactions: FinanceTransaction[]
  today: string
}

export type QuestApi = {
  getState: () => Promise<AppState>
  createProject: (payload: Pick<Project, 'name' | 'description'>) => Promise<AppState>
  updateProject: (payload: Pick<Project, 'id' | 'name' | 'description'>) => Promise<AppState>
  deleteProject: (id: number) => Promise<AppState>
  createQuest: (payload: {
    projectId: number
    title: string
    description: string
    difficulty: Difficulty
    xp: number
    type: QuestType
  }) => Promise<AppState>
  updateQuest: (payload: {
    id: number
    title: string
    description: string
    difficulty: Difficulty
    xp: number
    type: QuestType
  }) => Promise<AppState>
  deleteQuest: (id: number) => Promise<AppState>
  completeQuest: (id: number) => Promise<{ state: AppState; result: { xp: number; leveledUp: boolean; level?: number } }>
  reorderQuests: (ids: number[]) => Promise<AppState>
  updateSettings: (payload: {
    userName: string
    accessCode?: string
    currency: string
    monthlyBudget: number
    soundEnabled: boolean
  }) => Promise<AppState>
  createTransaction: (payload: {
    type: 'income' | 'expense'
    title: string
    category: string
    amount: number
    date: string
    note: string
  }) => Promise<AppState>
  deleteTransaction: (id: number) => Promise<AppState>
}

declare global {
  interface Window {
    questApi?: QuestApi
  }
}
