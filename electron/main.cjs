const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const initSqlJs = require('sql.js');

const isDev = !app.isPackaged;
let db;
let dbPath;

const todayKey = () => new Date().toISOString().slice(0, 10);

function run(sql, params = []) {
  db.run(sql, params);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql, params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function one(sql, params = []) {
  return all(sql, params)[0];
}

function saveDb() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function xpForNextLevel(level) {
  return 120 + (Math.max(1, level) - 1) * 55;
}

function applyProjectXp(projectId, delta) {
  const project = one('SELECT id, xp, level FROM projects WHERE id = ?', [projectId]);
  if (!project) return { leveledUp: false, level: 1 };

  let xp = Math.max(0, Number(project.xp) + delta);
  let level = Number(project.level);
  let leveledUp = false;

  while (xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
    leveledUp = true;
  }

  run('UPDATE projects SET xp = ?, level = ?, updated_at = ? WHERE id = ?', [
    xp,
    level,
    new Date().toISOString(),
    projectId,
  ]);

  return { leveledUp, level };
}

function initializeSchema() {
  run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      difficulty TEXT NOT NULL CHECK(difficulty IN ('facile', 'moyen', 'difficile')),
      xp INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('daily', 'normal')),
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      last_reset_date TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      total_xp INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT,
      penalty_xp INTEGER NOT NULL DEFAULT 0
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS quest_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      xp_delta INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      user_name TEXT NOT NULL DEFAULT 'Hunter',
      access_code TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'XOF',
      monthly_budget REAL NOT NULL DEFAULT 250000,
      sound_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  run(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      tx_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  run(`
    INSERT OR IGNORE INTO stats (id, total_xp, completed_tasks, streak, last_active_date, penalty_xp)
    VALUES (1, 0, 0, 0, NULL, 0);
  `);

  run(`
    INSERT OR IGNORE INTO app_settings
    (id, user_name, access_code, currency, monthly_budget, sound_enabled, updated_at)
    VALUES (1, 'Hunter', '', 'XOF', 250000, 0, ?);
  `, [new Date().toISOString()]);

  run(`
    UPDATE app_settings
    SET currency = CASE WHEN currency IN ('EUR', 'FCFA') THEN 'XOF' ELSE currency END,
        monthly_budget = CASE WHEN monthly_budget = 1200 THEN 250000 ELSE monthly_budget END,
        updated_at = ?
    WHERE id = 1 AND (currency IN ('EUR', 'FCFA') OR monthly_budget = 1200);
  `, [new Date().toISOString()]);

  const projectCount = one('SELECT COUNT(*) AS count FROM projects').count;
  if (Number(projectCount) === 0) {
    seedDatabase();
  }
}

function seedDatabase() {
  const now = new Date().toISOString();
  run('INSERT INTO projects (name, description, level, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    'Ascension personnelle',
    'Noyau de progression: etudes, sport, business et discipline.',
    3,
    180,
    now,
    now,
  ]);
  const personalProjectId = Number(one('SELECT last_insert_rowid() AS id').id);

  run('INSERT INTO projects (name, description, level, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    'Commerce',
    'Quetes de croissance, prospection, offres et systemes.',
    2,
    60,
    now,
    now,
  ]);
  const commerceProjectId = Number(one('SELECT last_insert_rowid() AS id').id);

  const quests = [
    [personalProjectId, 'Routine du matin', 'Hydratation, plan du jour, 20 minutes de mouvement.', 'facile', 35, 'daily', 0],
    [personalProjectId, 'Bloc focus profond', '90 minutes sans distraction sur la priorite alpha.', 'moyen', 75, 'daily', 1],
    [
      personalProjectId,
      'Entrainement force',
      'Session complete ou alternative courte sans casser la chaine.',
      'difficile',
      110,
      'normal',
      2,
    ],
    [commerceProjectId, 'Prospection ciblee', 'Contacter 5 prospects qualifies avec un message personnalise.', 'moyen', 85, 'daily', 0],
    [commerceProjectId, 'Optimiser une offre', 'Revoir promesse, preuves, objections et prochaine action.', 'difficile', 130, 'normal', 1],
  ];

  quests.forEach((quest) => {
    run(
      `INSERT INTO quests
       (project_id, title, description, difficulty, xp, type, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...quest, now, now],
    );
  });

  const transactions = [
    ['income', 'Salaire / revenu principal', 'Revenus', 350000, todayKey(), 'Base mensuelle'],
    ['expense', 'Courses', 'Alimentation', 42000, todayKey(), 'Depense exemple'],
    ['expense', 'Abonnement outils', 'Business', 18000, todayKey(), 'Logiciels'],
    ['expense', 'Transport', 'Mobilite', 25000, todayKey(), 'Trajet'],
  ];

  transactions.forEach((tx) => {
    run(
      `INSERT INTO finance_transactions
       (type, title, category, amount, tx_date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [...tx, now],
    );
  });
}

function resetDailies() {
  const today = todayKey();
  const dailies = all("SELECT * FROM quests WHERE type = 'daily'");
  let penalty = 0;
  let missed = 0;

  dailies.forEach((quest) => {
    if (quest.last_reset_date && quest.last_reset_date !== today && Number(quest.completed) === 0) {
      const loss = Math.ceil(Number(quest.xp) * 0.35);
      penalty += loss;
      missed += 1;
      applyProjectXp(Number(quest.project_id), -loss);
      run(
        'INSERT INTO quest_log (quest_id, project_id, action, xp_delta, created_at) VALUES (?, ?, ?, ?, ?)',
        [quest.id, quest.project_id, 'missed_daily', -loss, new Date().toISOString()],
      );
    }
  });

  run(
    `UPDATE quests
     SET completed = 0, completed_at = NULL, last_reset_date = ?, updated_at = ?
     WHERE type = 'daily' AND COALESCE(last_reset_date, '') != ?`,
    [today, new Date().toISOString(), today],
  );

  if (penalty > 0) {
    run(
      `UPDATE stats
       SET penalty_xp = penalty_xp + ?, streak = CASE WHEN streak > 0 THEN streak - 1 ELSE 0 END
       WHERE id = 1`,
      [penalty],
    );
  } else if (missed === 0) {
    run('UPDATE stats SET last_active_date = COALESCE(last_active_date, ?) WHERE id = 1', [today]);
  }
}

function getState() {
  resetDailies();
  const projects = all('SELECT * FROM projects ORDER BY updated_at DESC');
  const quests = all('SELECT * FROM quests ORDER BY position ASC, id DESC');
  const stats = one('SELECT * FROM stats WHERE id = 1');
  const settings = one('SELECT * FROM app_settings WHERE id = 1');
  const transactions = all('SELECT * FROM finance_transactions ORDER BY tx_date DESC, id DESC');
  saveDb();
  return { projects, quests, stats, settings, transactions, today: todayKey() };
}

async function initializeDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
  dbPath = path.join(app.getPath('userData'), 'producboost.sqlite');
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  run('PRAGMA foreign_keys = ON;');
  initializeSchema();
  resetDailies();
  saveDb();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#050711',
    title: 'ProducBoost System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.handle('state:get', () => getState());

ipcMain.handle('project:create', (_event, payload) => {
  const now = new Date().toISOString();
  run('INSERT INTO projects (name, description, level, xp, created_at, updated_at) VALUES (?, ?, 1, 0, ?, ?)', [
    payload.name,
    payload.description || '',
    now,
    now,
  ]);
  saveDb();
  return getState();
});

ipcMain.handle('project:update', (_event, payload) => {
  run('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?', [
    payload.name,
    payload.description || '',
    new Date().toISOString(),
    payload.id,
  ]);
  saveDb();
  return getState();
});

ipcMain.handle('project:delete', (_event, id) => {
  run('DELETE FROM projects WHERE id = ?', [id]);
  saveDb();
  return getState();
});

ipcMain.handle('quest:create', (_event, payload) => {
  const now = new Date().toISOString();
  const maxPosition = one('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM quests WHERE project_id = ?', [
    payload.projectId,
  ]).next;
  run(
    `INSERT INTO quests
     (project_id, title, description, difficulty, xp, type, position, last_reset_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.projectId,
      payload.title,
      payload.description || '',
      payload.difficulty,
      payload.xp,
      payload.type,
      maxPosition,
      payload.type === 'daily' ? todayKey() : null,
      now,
      now,
    ],
  );
  saveDb();
  return getState();
});

ipcMain.handle('quest:update', (_event, payload) => {
  run(
    `UPDATE quests
     SET title = ?, description = ?, difficulty = ?, xp = ?, type = ?, updated_at = ?
     WHERE id = ?`,
    [
      payload.title,
      payload.description || '',
      payload.difficulty,
      payload.xp,
      payload.type,
      new Date().toISOString(),
      payload.id,
    ],
  );
  saveDb();
  return getState();
});

ipcMain.handle('quest:delete', (_event, id) => {
  run('DELETE FROM quests WHERE id = ?', [id]);
  saveDb();
  return getState();
});

ipcMain.handle('quest:complete', (_event, id) => {
  const quest = one('SELECT * FROM quests WHERE id = ?', [id]);
  if (!quest || Number(quest.completed) === 1) return { state: getState(), result: { xp: 0, leveledUp: false } };

  const now = new Date().toISOString();
  run('UPDATE quests SET completed = 1, completed_at = ?, last_reset_date = ?, updated_at = ? WHERE id = ?', [
    now,
    todayKey(),
    now,
    id,
  ]);

  const projectResult = applyProjectXp(Number(quest.project_id), Number(quest.xp));
  const stats = one('SELECT last_active_date, streak FROM stats WHERE id = 1');
  const today = todayKey();
  const streak = stats.last_active_date === today ? Number(stats.streak) : Number(stats.streak) + 1;

  run(
    `UPDATE stats
     SET total_xp = total_xp + ?, completed_tasks = completed_tasks + 1, streak = ?, last_active_date = ?
     WHERE id = 1`,
    [quest.xp, streak, today],
  );
  run('INSERT INTO quest_log (quest_id, project_id, action, xp_delta, created_at) VALUES (?, ?, ?, ?, ?)', [
    quest.id,
    quest.project_id,
    'completed',
    quest.xp,
    now,
  ]);
  saveDb();
  return { state: getState(), result: { xp: Number(quest.xp), leveledUp: projectResult.leveledUp, level: projectResult.level } };
});

ipcMain.handle('quest:reorder', (_event, orderedIds) => {
  orderedIds.forEach((id, index) => {
    run('UPDATE quests SET position = ?, updated_at = ? WHERE id = ?', [index, new Date().toISOString(), id]);
  });
  saveDb();
  return getState();
});

ipcMain.handle('settings:update', (_event, payload) => {
  const current = one('SELECT * FROM app_settings WHERE id = 1');
  run(
    `UPDATE app_settings
     SET user_name = ?, access_code = ?, currency = ?, monthly_budget = ?, sound_enabled = ?, updated_at = ?
     WHERE id = 1`,
    [
      payload.userName || current.user_name,
      payload.accessCode ?? current.access_code,
      payload.currency || current.currency,
      Number(payload.monthlyBudget ?? current.monthly_budget),
      payload.soundEnabled ? 1 : 0,
      new Date().toISOString(),
    ],
  );
  saveDb();
  return getState();
});

ipcMain.handle('finance:create', (_event, payload) => {
  run(
    `INSERT INTO finance_transactions
     (type, title, category, amount, tx_date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.type,
      payload.title,
      payload.category,
      Number(payload.amount),
      payload.date || todayKey(),
      payload.note || '',
      new Date().toISOString(),
    ],
  );
  saveDb();
  return getState();
});

ipcMain.handle('finance:delete', (_event, id) => {
  run('DELETE FROM finance_transactions WHERE id = ?', [id]);
  saveDb();
  return getState();
});

app.whenReady().then(async () => {
  await initializeDatabase();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
