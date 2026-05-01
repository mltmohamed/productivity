import type { Difficulty, Project, Quest, Stats } from '../types'

export const xpForNextLevel = (level: number) => 120 + (Math.max(1, level) - 1) * 55

export const projectProgress = (project: Project) => {
  const next = xpForNextLevel(project.level)
  return Math.min(100, Math.round((project.xp / next) * 100))
}

export const difficultyXp: Record<Difficulty, number> = {
  facile: 35,
  moyen: 75,
  difficile: 120,
}

export const difficultyLabel: Record<Difficulty, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
}

export const totalLevel = (projects: Project[]) =>
  projects.reduce((sum, project) => sum + Number(project.level), 0)

export const activeToday = (quests: Quest[]) =>
  quests.filter((quest) => quest.type === 'daily' && Number(quest.completed) === 0)

export const completionRate = (quests: Quest[]) => {
  if (quests.length === 0) return 0
  return Math.round((quests.filter((quest) => Number(quest.completed) === 1).length / quests.length) * 100)
}

export const systemRank = (stats: Stats) => {
  if (stats.total_xp > 2500) return 'S'
  if (stats.total_xp > 1400) return 'A'
  if (stats.total_xp > 700) return 'B'
  if (stats.total_xp > 250) return 'C'
  return 'D'
}
