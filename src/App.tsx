import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AnimatePresence, Reorder, motion } from 'framer-motion'
import {
  AlarmClock,
  ArrowDownCircle,
  ArrowUpCircle,
  BatteryCharging,
  CalendarDays,
  Check,
  Coins,
  Flame,
  Focus,
  FolderPlus,
  Gauge,
  LayoutDashboard,
  Lock,
  LogOut,
  PiggyBank,
  Plus,
  Settings,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  Trash2,
  Wallet,
} from 'lucide-react'
import './App.css'
import type { AppState, Difficulty, FinanceTransaction, Project, Quest, QuestType } from './types'
import {
  activeToday,
  completionRate,
  difficultyLabel,
  difficultyXp,
  projectProgress,
  systemRank,
  totalLevel,
  xpForNextLevel,
} from './lib/progression'

type View = 'dashboard' | 'finance' | 'settings'

const fallbackState: AppState = {
  today: new Date().toISOString().slice(0, 10),
  settings: {
    id: 1,
    user_name: 'Hunter',
    access_code: '',
    currency: 'XOF',
    monthly_budget: 250000,
    sound_enabled: 0,
    updated_at: '',
  },
  transactions: [],
  projects: [
    {
      id: 1,
      name: 'Demo Offline',
      description: 'Lance Electron pour activer SQLite local.',
      level: 1,
      xp: 40,
      created_at: '',
      updated_at: '',
    },
  ],
  quests: [
    {
      id: 1,
      project_id: 1,
      title: 'Ouvrir le mode desktop',
      description: 'npm run dev charge Electron, le preload et la base SQLite locale.',
      difficulty: 'facile',
      xp: 35,
      type: 'daily',
      completed: 0,
      completed_at: null,
      last_reset_date: null,
      position: 0,
      created_at: '',
      updated_at: '',
    },
  ],
  stats: { id: 1, total_xp: 0, completed_tasks: 0, streak: 0, last_active_date: null, penalty_xp: 0 },
}

function App() {
  const [state, setState] = useState<AppState>(fallbackState)
  const [activeProjectId, setActiveProjectId] = useState(1)
  const [view, setView] = useState<View>('dashboard')
  const [authenticated, setAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [message, setMessage] = useState('SYSTEM READY')
  const [levelPulse, setLevelPulse] = useState(false)
  const [focusQuest, setFocusQuest] = useState<Quest | null>(null)
  const [pomodoro, setPomodoro] = useState(25 * 60)
  const [timerActive, setTimerActive] = useState(false)

  const api = window.questApi
  const activeProject = state.projects.find((project) => project.id === activeProjectId) ?? state.projects[0]
  const projectQuests = useMemo(
    () => state.quests.filter((quest) => quest.project_id === activeProject?.id),
    [activeProject?.id, state.quests],
  )
  const todayQuests = useMemo(() => activeToday(state.quests), [state.quests])
  const finance = useMemo(() => getFinanceSummary(state.transactions, state.settings.monthly_budget), [state])
  const money = useMemo(() => currencyFormatter(state.settings.currency), [state.settings.currency])

  useEffect(() => {
    api?.getState().then((nextState) => {
      setState(nextState)
      setActiveProjectId(nextState.projects[0]?.id ?? 1)
    })
  }, [api])

  useEffect(() => {
    if (!timerActive) return
    const interval = window.setInterval(() => {
      setPomodoro((value) => {
        if (value <= 1) {
          setTimerActive(false)
          setMessage('FOCUS SESSION COMPLETE')
          return 25 * 60
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [timerActive])

  const syncState = (nextState: AppState) => {
    setState(nextState)
    if (!nextState.projects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(nextState.projects[0]?.id ?? 1)
    }
  }

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || state.settings.user_name || 'Hunter').trim()
    const code = String(form.get('code') || '').trim()

    if (!state.settings.access_code) {
      const nextState = await api?.updateSettings({
        userName: name,
        accessCode: code,
        currency: state.settings.currency,
        monthlyBudget: state.settings.monthly_budget,
        soundEnabled: Boolean(state.settings.sound_enabled),
      })
      if (nextState) syncState(nextState)
      setAuthenticated(true)
      setMessage(`WELCOME ${name.toUpperCase()}`)
      return
    }

    if (code === state.settings.access_code) {
      setAuthenticated(true)
      setLoginError('')
      setMessage(`WELCOME BACK ${state.settings.user_name.toUpperCase()}`)
    } else {
      setLoginError('Code systeme incorrect.')
    }
  }

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const name = String(form.get('name') || '').trim()
    if (!name) return
    const nextState = await api?.createProject({
      name,
      description: String(form.get('description') || '').trim(),
    })
    formElement.reset()
    if (nextState) {
      syncState(nextState)
      setActiveProjectId(nextState.projects[0]?.id ?? activeProjectId)
      setMessage('NEW PROJECT REGISTERED')
    }
  }

  const createQuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeProject) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const difficulty = String(form.get('difficulty')) as Difficulty
    const nextState = await api?.createQuest({
      projectId: activeProject.id,
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim(),
      difficulty,
      xp: Number(form.get('xp')) || difficultyXp[difficulty],
      type: String(form.get('type')) as QuestType,
    })
    formElement.reset()
    if (nextState) {
      syncState(nextState)
      setMessage('QUEST GENERATED')
    }
  }

  const createTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const nextState = await api?.createTransaction({
      type: String(form.get('type')) as 'income' | 'expense',
      title: String(form.get('title') || '').trim(),
      category: String(form.get('category') || 'General').trim(),
      amount: Number(form.get('amount')) || 0,
      date: String(form.get('date') || state.today),
      note: String(form.get('note') || '').trim(),
    })
    formElement.reset()
    if (nextState) {
      syncState(nextState)
      setMessage('FINANCE ENTRY LOGGED')
    }
  }

  const updateSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextState = await api?.updateSettings({
      userName: String(form.get('userName') || 'Hunter').trim(),
      accessCode: String(form.get('accessCode') || ''),
      currency: String(form.get('currency') || 'XOF'),
      monthlyBudget: Number(form.get('monthlyBudget')) || 0,
      soundEnabled: form.get('soundEnabled') === 'on',
    })
    if (nextState) {
      syncState(nextState)
      setMessage('SETTINGS SYNCHRONIZED')
    }
  }

  const completeQuest = async (quest: Quest) => {
    const response = await api?.completeQuest(quest.id)
    if (!response) return
    syncState(response.state)
    setMessage(`+${response.result.xp} XP ACQUIRED`)
    setLevelPulse(response.result.leveledUp)
    if (response.result.leveledUp) window.setTimeout(() => setLevelPulse(false), 1800)
  }

  const deleteProject = async (project: Project) => {
    const nextState = await api?.deleteProject(project.id)
    if (nextState) {
      syncState(nextState)
      setMessage('PROJECT ARCHIVED')
    }
  }

  const deleteQuest = async (quest: Quest) => {
    const nextState = await api?.deleteQuest(quest.id)
    if (nextState) {
      syncState(nextState)
      setMessage('QUEST DISMISSED')
    }
  }

  const deleteTransaction = async (tx: FinanceTransaction) => {
    const nextState = await api?.deleteTransaction(tx.id)
    if (nextState) {
      syncState(nextState)
      setMessage('FINANCE ENTRY DELETED')
    }
  }

  const reorderQuests = (ordered: Quest[]) => {
    setState((current) => ({
      ...current,
      quests: [...current.quests.filter((quest) => quest.project_id !== activeProject?.id), ...ordered],
    }))
    api?.reorderQuests(ordered.map((quest) => quest.id)).then(syncState)
  }

  const minutes = String(Math.floor(pomodoro / 60)).padStart(2, '0')
  const seconds = String(pomodoro % 60).padStart(2, '0')

  if (!authenticated) {
    return <LoginScreen state={state} error={loginError} onLogin={login} />
  }

  return (
    <main className="app-shell">
      <div className="scanline" />
      <AnimatePresence>
        {levelPulse && (
          <motion.div
            className="level-burst"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
          >
            LEVEL UP
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="sidebar">
        <div className="brand">
          <Sparkles />
          <div>
            <span>ProducBoost</span>
            <strong>Shadow System</strong>
          </div>
        </div>

        <nav className="main-nav">
          <NavButton icon={<LayoutDashboard size={18} />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavButton icon={<Wallet size={18} />} label="Finances" active={view === 'finance'} onClick={() => setView('finance')} />
          <NavButton icon={<Settings size={18} />} label="Parametres" active={view === 'settings'} onClick={() => setView('settings')} />
        </nav>

        {view === 'dashboard' && (
          <>
            <form className="project-form" onSubmit={createProject}>
              <input name="name" placeholder="Nouveau projet" />
              <input name="description" placeholder="Objectif strategique" />
              <button type="submit" title="Creer un projet">
                <FolderPlus size={18} />
              </button>
            </form>

            <div className="project-list">
              {state.projects.map((project) => (
                <button
                  className={project.id === activeProject?.id ? 'project-tab active' : 'project-tab'}
                  key={project.id}
                  onClick={() => setActiveProjectId(project.id)}
                  type="button"
                >
                  <span>{project.name}</span>
                  <small>LV {project.level}</small>
                </button>
              ))}
            </div>
          </>
        )}

        <button className="logout-button" type="button" onClick={() => setAuthenticated(false)}>
          <LogOut size={18} />
          Se deconnecter
        </button>
      </aside>

      <section className="command-center">
        <header className="system-header">
          <div>
            <p className="eyebrow">SYSTEM MESSAGE</p>
            <h1>{message}</h1>
          </div>
          <div className="rank-core">
            <span>RANK</span>
            <strong>{systemRank(state.stats)}</strong>
          </div>
        </header>

        {view === 'dashboard' && (
          <DashboardView
            activeProject={activeProject}
            projectQuests={projectQuests}
            todayQuests={todayQuests}
            state={state}
            minutes={minutes}
            seconds={seconds}
            timerActive={timerActive}
            onDeleteProject={deleteProject}
            onCompleteQuest={completeQuest}
            onDeleteQuest={deleteQuest}
            onFocusQuest={setFocusQuest}
            onReorderQuests={reorderQuests}
            onCreateQuest={createQuest}
            onToggleTimer={() => setTimerActive((value) => !value)}
          />
        )}

        {view === 'finance' && (
          <FinanceView
            finance={finance}
            money={money}
            transactions={state.transactions}
            today={state.today}
            onCreateTransaction={createTransaction}
            onDeleteTransaction={deleteTransaction}
          />
        )}

        {view === 'settings' && <SettingsView state={state} onUpdateSettings={updateSettings} onLogout={() => setAuthenticated(false)} />}
      </section>

      <AnimatePresence>
        {focusQuest && (
          <motion.div className="focus-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="focus-card" initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }}>
              <p className="eyebrow">FOCUS QUEST</p>
              <h2>{focusQuest.title}</h2>
              <p>{focusQuest.description}</p>
              <div className="focus-actions">
                <button onClick={() => setFocusQuest(null)} type="button">
                  Fermer
                </button>
                <button
                  onClick={() => {
                    completeQuest(focusQuest)
                    setFocusQuest(null)
                  }}
                  type="button"
                >
                  <Check size={18} />
                  Terminer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

function LoginScreen({ state, error, onLogin }: { state: AppState; error: string; onLogin: (event: FormEvent<HTMLFormElement>) => void }) {
  const firstRun = !state.settings.access_code

  return (
    <main className="login-shell">
      <div className="scanline" />
      <motion.form className="login-panel" onSubmit={onLogin} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="login-sigil">
          <Lock />
        </div>
        <p className="eyebrow">{firstRun ? 'FIRST SYNCHRONIZATION' : 'SYSTEM GATE'}</p>
        <h1>{firstRun ? 'Creer ton acces' : 'Connexion'}</h1>
        <input name="name" defaultValue={state.settings.user_name} placeholder="Nom du hunter" />
        <input name="code" type="password" placeholder={firstRun ? 'Definir un code local' : 'Code local'} />
        {error && <span className="form-error">{error}</span>}
        <button type="submit">
          <Sparkles size={18} />
          Entrer dans le systeme
        </button>
      </motion.form>
    </main>
  )
}

function DashboardView({
  activeProject,
  projectQuests,
  todayQuests,
  state,
  minutes,
  seconds,
  timerActive,
  onDeleteProject,
  onCompleteQuest,
  onDeleteQuest,
  onFocusQuest,
  onReorderQuests,
  onCreateQuest,
  onToggleTimer,
}: {
  activeProject?: Project
  projectQuests: Quest[]
  todayQuests: Quest[]
  state: AppState
  minutes: string
  seconds: string
  timerActive: boolean
  onDeleteProject: (project: Project) => void
  onCompleteQuest: (quest: Quest) => void
  onDeleteQuest: (quest: Quest) => void
  onFocusQuest: (quest: Quest) => void
  onReorderQuests: (quests: Quest[]) => void
  onCreateQuest: (event: FormEvent<HTMLFormElement>) => void
  onToggleTimer: () => void
}) {
  return (
    <>
      <section className="hud-grid">
        <StatCard icon={<Gauge />} label="Niveau global" value={totalLevel(state.projects)} />
        <StatCard icon={<BatteryCharging />} label="XP total" value={state.stats.total_xp} />
        <StatCard icon={<Check />} label="Quetes validees" value={state.stats.completed_tasks} />
        <StatCard icon={<Flame />} label="Streak" value={`${state.stats.streak}j`} />
        <StatCard icon={<ShieldAlert />} label="Penalites" value={`-${state.stats.penalty_xp}`} />
      </section>

      {activeProject && (
        <section className="project-panel">
          <div className="project-title">
            <div>
              <p className="eyebrow">ACTIVE PROJECT</p>
              <h2>{activeProject.name}</h2>
              <p>{activeProject.description}</p>
            </div>
            <button className="icon-danger" onClick={() => onDeleteProject(activeProject)} type="button" title="Supprimer">
              <Trash2 size={18} />
            </button>
          </div>
          <div className="xp-rail">
            <span>LV {activeProject.level}</span>
            <div>
              <motion.i animate={{ width: `${projectProgress(activeProject)}%` }} />
            </div>
            <span>
              {activeProject.xp}/{xpForNextLevel(activeProject.level)}
            </span>
          </div>
        </section>
      )}

      <div className="work-grid">
        <section className="quest-board">
          <div className="section-head">
            <div>
              <p className="eyebrow">QUEST LOG</p>
              <h2>{projectQuests.length} quetes actives</h2>
            </div>
            <span>{completionRate(projectQuests)}% clear</span>
          </div>

          <Reorder.Group axis="y" values={projectQuests} onReorder={onReorderQuests} className="quest-list">
            {projectQuests.map((quest) => (
              <Reorder.Item value={quest} key={quest.id}>
                <QuestCard
                  quest={quest}
                  onComplete={() => onCompleteQuest(quest)}
                  onDelete={() => onDeleteQuest(quest)}
                  onFocus={() => onFocusQuest(quest)}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </section>

        <aside className="right-rail">
          <form className="quest-form" onSubmit={onCreateQuest}>
            <p className="eyebrow">GENERATE QUEST</p>
            <input name="title" placeholder="Titre de quete" required />
            <textarea name="description" placeholder="Description" />
            <select name="difficulty" defaultValue="moyen">
              <option value="facile">Facile</option>
              <option value="moyen">Moyen</option>
              <option value="difficile">Difficile</option>
            </select>
            <select name="type" defaultValue="normal">
              <option value="daily">Quotidienne</option>
              <option value="normal">Normale</option>
            </select>
            <input name="xp" type="number" min="5" step="5" placeholder="XP custom" />
            <button type="submit">
              <Plus size={18} />
              Creer
            </button>
          </form>

          <div className="daily-panel">
            <p className="eyebrow">TODAY</p>
            <strong>{todayQuests.length} quetes journalieres restantes</strong>
            {todayQuests.slice(0, 4).map((quest) => (
              <button key={quest.id} onClick={() => onCompleteQuest(quest)} type="button">
                <Swords size={16} />
                {quest.title}
              </button>
            ))}
          </div>

          <div className="pomodoro">
            <p className="eyebrow">FOCUS MODE</p>
            <div className="timer">
              <AlarmClock />
              {minutes}:{seconds}
            </div>
            <button onClick={onToggleTimer} type="button">
              <Focus size={18} />
              {timerActive ? 'Pause' : 'Demarrer'}
            </button>
          </div>
        </aside>
      </div>
    </>
  )
}

function FinanceView({
  finance,
  money,
  transactions,
  today,
  onCreateTransaction,
  onDeleteTransaction,
}: {
  finance: ReturnType<typeof getFinanceSummary>
  money: Intl.NumberFormat
  transactions: FinanceTransaction[]
  today: string
  onCreateTransaction: (event: FormEvent<HTMLFormElement>) => void
  onDeleteTransaction: (tx: FinanceTransaction) => void
}) {
  return (
    <section className="finance-view">
      <div className="finance-grid">
        <StatCard icon={<Wallet />} label="Solde net" value={money.format(finance.balance)} />
        <StatCard icon={<ArrowUpCircle />} label="Entrees" value={money.format(finance.income)} />
        <StatCard icon={<ArrowDownCircle />} label="Depenses" value={money.format(finance.expense)} />
        <StatCard icon={<Coins />} label="Budget restant" value={money.format(finance.remainingBudget)} />
      </div>

      <div className="finance-layout">
        <section className="finance-board">
          <div className="section-head">
            <div>
              <p className="eyebrow">FINANCE CORE</p>
              <h2>Gestion financiere</h2>
            </div>
            <span>{finance.budgetUsage}% du budget</span>
          </div>
          <div className="budget-rail">
            <motion.i animate={{ width: `${Math.min(100, finance.budgetUsage)}%` }} />
          </div>

          <div className="finance-insights">
            <article>
              <PiggyBank />
              <span>Epargne estimee</span>
              <strong>{money.format(finance.savings)}</strong>
              <small>{finance.savingsRate}% des entrees</small>
            </article>
            <article>
              <CalendarDays />
              <span>Moyenne depensee</span>
              <strong>{money.format(finance.dailyAverage)}</strong>
              <small>par jour actif</small>
            </article>
            <article>
              <TrendingDown />
              <span>Projection mensuelle</span>
              <strong>{money.format(finance.projectedExpense)}</strong>
              <small>{finance.projectedBudgetUsage}% du budget</small>
            </article>
            <article>
              <Target />
              <span>Plus gros poste</span>
              <strong>{finance.topCategory?.name ?? 'Aucune'}</strong>
              <small>{finance.topCategory ? money.format(finance.topCategory.amount) : '0 operation'}</small>
            </article>
          </div>

          <div className={`finance-health ${finance.healthTone}`}>
            <div>
              <p className="eyebrow">ETAT DU MOIS</p>
              <strong>{finance.healthLabel}</strong>
            </div>
            <span>{finance.transactionsCount} operation(s)</span>
          </div>

          <div className="category-grid">
            {finance.categories.length === 0 && <p className="empty-state">Aucune depense enregistree pour le moment.</p>}
            {finance.categories.map((category) => (
              <article className="category-card" key={category.name}>
                <span>{category.name}</span>
                <strong>{money.format(category.amount)}</strong>
                <small>
                  {category.count} operation(s) | {category.share}% des depenses
                </small>
              </article>
            ))}
          </div>

          <div className="transaction-list">
            <div className="transaction-list-head">
              <p className="eyebrow">JOURNAL</p>
              <span>{transactions.length} ligne(s)</span>
            </div>
            {transactions.map((tx) => (
              <article className={`transaction-row ${tx.type}`} key={tx.id}>
                <div>
                  <span>{tx.type === 'income' ? 'Entree' : 'Depense'}</span>
                  <h3>{tx.title}</h3>
                  <p>
                    {tx.category} | {tx.tx_date} {tx.note ? `| ${tx.note}` : ''}
                  </p>
                </div>
                <strong>{tx.type === 'income' ? '+' : '-'}{money.format(Number(tx.amount))}</strong>
                <button onClick={() => onDeleteTransaction(tx)} type="button" title="Supprimer">
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
            {transactions.length === 0 && <p className="empty-state">Ajoute ta premiere entree ou depense pour demarrer le suivi.</p>}
          </div>
        </section>

        <form className="finance-form" onSubmit={onCreateTransaction}>
          <p className="eyebrow">NEW MONEY LOG</p>
          <select name="type" defaultValue="expense">
            <option value="expense">Depense</option>
            <option value="income">Entree</option>
          </select>
          <input name="title" placeholder="Libelle" required />
          <input name="category" list="finance-categories" placeholder="Categorie: loyer, business..." required />
          <datalist id="finance-categories">
            <option value="Revenus" />
            <option value="Loyer" />
            <option value="Alimentation" />
            <option value="Transport" />
            <option value="Business" />
            <option value="Epargne" />
            <option value="Sante" />
            <option value="Famille" />
            <option value="Loisirs" />
          </datalist>
          <input name="amount" type="number" min="0" step="1" placeholder="Montant en FCFA" required />
          <input name="date" type="date" defaultValue={today} />
          <textarea name="note" placeholder="Note optionnelle" />
          <button type="submit">
            <Plus size={18} />
            Ajouter
          </button>
        </form>
      </div>
    </section>
  )
}

function SettingsView({
  state,
  onUpdateSettings,
  onLogout,
}: {
  state: AppState
  onUpdateSettings: (event: FormEvent<HTMLFormElement>) => void
  onLogout: () => void
}) {
  return (
    <section className="settings-view">
      <form className="settings-panel" onSubmit={onUpdateSettings}>
        <p className="eyebrow">SYSTEM CONFIGURATION</p>
        <h2>Parametres</h2>
        <label>
          Nom utilisateur
          <input name="userName" defaultValue={state.settings.user_name} />
        </label>
        <label>
          Code local
          <input name="accessCode" type="password" defaultValue={state.settings.access_code} />
        </label>
        <label>
          Devise
          <select name="currency" defaultValue={state.settings.currency}>
            <option value="XOF">FCFA</option>
            <option value="USD">USD</option>
            <option value="MAD">MAD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
        <label>
          Budget mensuel
          <input name="monthlyBudget" type="number" min="0" step="1" defaultValue={state.settings.monthly_budget} />
        </label>
        <label className="toggle-row">
          Sons RPG
          <input name="soundEnabled" type="checkbox" defaultChecked={Boolean(state.settings.sound_enabled)} />
        </label>
        <div className="settings-actions">
          <button type="submit">
            <Settings size={18} />
            Sauvegarder
          </button>
          <button type="button" onClick={onLogout}>
            <Lock size={18} />
            Verrouiller
          </button>
        </div>
      </form>
    </section>
  )
}

function NavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick} type="button">
      {icon}
      {label}
    </button>
  )
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <motion.article className="stat-card" whileHover={{ y: -4 }}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </motion.article>
  )
}

function QuestCard({
  quest,
  onComplete,
  onDelete,
  onFocus,
}: {
  quest: Quest
  onComplete: () => void
  onDelete: () => void
  onFocus: () => void
}) {
  const done = Number(quest.completed) === 1

  return (
    <motion.article className={done ? 'quest-card done' : 'quest-card'} whileHover={{ scale: 1.01 }}>
      <div>
        <span className={`difficulty ${quest.difficulty}`}>{difficultyLabel[quest.difficulty]}</span>
        <h3>{quest.title}</h3>
        <p>{quest.description}</p>
      </div>
      <div className="quest-meta">
        <strong>+{quest.xp} XP</strong>
        <small>{quest.type === 'daily' ? 'Daily' : 'Normal'}</small>
        <button onClick={onFocus} type="button" title="Mode focus">
          <Focus size={17} />
        </button>
        <button onClick={onComplete} disabled={done} type="button" title="Terminer">
          <Check size={17} />
        </button>
        <button onClick={onDelete} type="button" title="Supprimer">
          <Trash2 size={17} />
        </button>
      </div>
    </motion.article>
  )
}

function currencyFormatter(currency: string) {
  if (currency === 'FCFA') currency = 'XOF'

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'XOF' ? 0 : 2,
  })
}

function getFinanceSummary(transactions: FinanceTransaction[], monthlyBudget: number) {
  const income = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0)
  const expense = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount), 0)
  const activeExpenseDays = new Set(transactions.filter((tx) => tx.type === 'expense').map((tx) => tx.tx_date)).size
  const dayOfMonth = new Date().getDate()
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const dailyAverage = activeExpenseDays > 0 ? expense / activeExpenseDays : 0
  const projectedExpense = dayOfMonth > 0 ? (expense / dayOfMonth) * daysInMonth : expense
  const categories = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce<Record<string, { name: string; amount: number; count: number }>>((acc, tx) => {
      acc[tx.category] ??= { name: tx.category, amount: 0, count: 0 }
      acc[tx.category].amount += Number(tx.amount)
      acc[tx.category].count += 1
      return acc
    }, {})
  const categoryList = Object.values(categories)
    .map((category) => ({
      ...category,
      share: expense > 0 ? Math.round((category.amount / expense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
  const savings = income - expense
  const budgetUsage = monthlyBudget > 0 ? Math.round((expense / Number(monthlyBudget)) * 100) : 0
  const projectedBudgetUsage = monthlyBudget > 0 ? Math.round((projectedExpense / Number(monthlyBudget)) * 100) : 0
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0
  const healthTone = savings < 0 || budgetUsage >= 100 ? 'danger' : budgetUsage >= 80 ? 'warning' : 'good'
  const healthLabel =
    healthTone === 'danger'
      ? 'Alerte: le mois depasse la zone saine'
      : healthTone === 'warning'
        ? 'Attention: budget sous pression'
        : 'Stable: marge encore disponible'

  return {
    income,
    expense,
    balance: income - expense,
    remainingBudget: Math.max(0, Number(monthlyBudget) - expense),
    budgetUsage,
    savings,
    savingsRate,
    dailyAverage,
    projectedExpense,
    projectedBudgetUsage,
    topCategory: categoryList[0],
    transactionsCount: transactions.length,
    healthTone,
    healthLabel,
    categories: categoryList,
  }
}

export default App
