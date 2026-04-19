import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase;

export type TutorSettings = {
  reply_translation: boolean;
  reply_explanation: boolean;
  reply_usage_notes: boolean;
  reply_vocabulary: boolean;
  vocabulary_level: "Beginner" | "Intermediate" | "Advanced" | "All Levels";
  key_points_mode: "Balanced" | "Vocabulary" | "Practical Expressions" | "Grammar";
  key_points_max_cards: number;
  ai_decide_detail: "Minimal" | "Balanced" | "Detailed";
  ai_decide_sentence_handling: "Let AI choose" | "Prefer whole sentence" | "Prefer key points";
  ai_decide_skip_obvious: boolean;
};

export type CurrentUser = {
  id: number;
  email: string;
  display_name?: string | null;
  created_at: number;
};

export type SystemLanguage =
  | "English"
  | "Chinese"
  | "Spanish"
  | "French"
  | "German"
  | "Portuguese"
  | "Japanese"
  | "Korean"
  | "Arabic"
  | "Russian"
  | "Hindi"
  | "Italian";

export const DEFAULT_TUTOR_SETTINGS: TutorSettings = {
  reply_translation: true,
  reply_explanation: true,
  reply_usage_notes: true,
  reply_vocabulary: true,
  vocabulary_level: "Beginner",
  key_points_mode: "Balanced",
  key_points_max_cards: 3,
  ai_decide_detail: "Balanced",
  ai_decide_sentence_handling: "Let AI choose",
  ai_decide_skip_obvious: true,
};

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("flashcards.db");
    await initSchema(db);
  }
  return db;
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS decks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      cards_study_per_day INTEGER DEFAULT 20,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS cards (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id    INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      front      TEXT NOT NULL,
      back       TEXT NOT NULL,
      front_lang TEXT DEFAULT 'fr',
      back_lang  TEXT DEFAULT 'zh',
      front_image_uri TEXT,
      back_image_uri  TEXT,
      front_bold      INTEGER DEFAULT 0,
      back_bold       INTEGER DEFAULT 0,
      front_underline INTEGER DEFAULT 0,
      back_underline  INTEGER DEFAULT 0,
      bond_level TEXT DEFAULT 'new',
      known      INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const deckColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(decks)");
  const deckColumnNames = new Set(deckColumns.map((column) => column.name));
  if (!deckColumnNames.has("cards_study_per_day")) {
    await db.execAsync("ALTER TABLE decks ADD COLUMN cards_study_per_day INTEGER DEFAULT 20");
  }

  const cardColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(cards)");
  const cardColumnNames = new Set(cardColumns.map((column) => column.name));
  const cardMigrations = [
    ["front_image_uri", "ALTER TABLE cards ADD COLUMN front_image_uri TEXT"],
    ["back_image_uri", "ALTER TABLE cards ADD COLUMN back_image_uri TEXT"],
    ["front_bold", "ALTER TABLE cards ADD COLUMN front_bold INTEGER DEFAULT 0"],
    ["back_bold", "ALTER TABLE cards ADD COLUMN back_bold INTEGER DEFAULT 0"],
    ["front_underline", "ALTER TABLE cards ADD COLUMN front_underline INTEGER DEFAULT 0"],
    ["back_underline", "ALTER TABLE cards ADD COLUMN back_underline INTEGER DEFAULT 0"],
    ["bond_level", "ALTER TABLE cards ADD COLUMN bond_level TEXT DEFAULT 'new'"],
  ] as const;

  for (const [name, sql] of cardMigrations) {
    if (!cardColumnNames.has(name)) {
      await db.execAsync(sql);
    }
  }
}

// ---------- App Settings ----------

export async function getTutorSettings(): Promise<TutorSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: keyof TutorSettings; value: string }>(
    "SELECT key, value FROM app_settings WHERE key LIKE 'tutor_%'"
  );

  const settings: TutorSettings = { ...DEFAULT_TUTOR_SETTINGS };
  for (const row of rows) {
    const key = row.key.replace("tutor_", "") as keyof TutorSettings;
    if (!(key in settings)) continue;

    if (row.value === "true" || row.value === "false") {
      (settings as any)[key] = row.value === "true";
    } else if (key === "key_points_max_cards") {
      const parsed = Number.parseInt(row.value, 10);
      (settings as any)[key] = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 20) : 3;
    } else {
      (settings as any)[key] = row.value;
    }
  }

  return settings;
}

export async function updateTutorSetting<K extends keyof TutorSettings>(
  key: K,
  value: TutorSettings[K]
) {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
    `tutor_${String(key)}`,
    String(value)
  );
}

export async function getLocalLearningStats() {
  const db = await getDb();
  const deckStats = await db.getFirstAsync<{ deck_count: number }>(
    "SELECT COUNT(*) as deck_count FROM decks"
  );
  const cardStats = await db.getFirstAsync<{ card_count: number }>(
    "SELECT COUNT(*) as card_count FROM cards"
  );

  return {
    deckCount: deckStats?.deck_count ?? 0,
    cardCount: cardStats?.card_count ?? 0,
    studiedToday: 0,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = ?",
    "current_user"
  );
  if (!row?.value) return null;

  try {
    return JSON.parse(row.value) as CurrentUser;
  } catch {
    return null;
  }
}

export async function setCurrentUser(user: CurrentUser) {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
    "current_user",
    JSON.stringify(user)
  );
}

export async function clearCurrentUser() {
  const db = await getDb();
  await db.runAsync("DELETE FROM app_settings WHERE key = ?", "current_user");
}

export async function getDailyStudyGoal(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = ?",
    "daily_study_goal"
  );
  const parsed = Number.parseInt(row?.value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

export async function updateDailyStudyGoal(goal: number) {
  const db = await getDb();
  const safeGoal = Math.max(1, Math.min(Math.floor(goal), 200));
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
    "daily_study_goal",
    String(safeGoal)
  );
}

export async function getSystemLanguage(): Promise<SystemLanguage> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = ?",
    "system_language"
  );
  const value = row?.value as SystemLanguage | undefined;
  const allowed: SystemLanguage[] = [
    "English",
    "Chinese",
    "Spanish",
    "French",
    "German",
    "Portuguese",
    "Japanese",
    "Korean",
    "Arabic",
    "Russian",
    "Hindi",
    "Italian",
  ];
  return value && allowed.includes(value) ? value : "English";
}

export async function updateSystemLanguage(language: SystemLanguage) {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
    "system_language",
    language
  );
}

// ---------- Decks ----------

export async function getAllDecks() {
  const db = await getDb();
  return db.getAllAsync<{ id: number; name: string; created_at: number; card_count: number }>(
    `SELECT d.*, COUNT(c.id) as card_count
     FROM decks d
     LEFT JOIN cards c ON c.deck_id = d.id
     GROUP BY d.id
     ORDER BY d.created_at DESC`
  );
}

export async function createDeck(name: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync("INSERT INTO decks (name) VALUES (?)", name);
  return result.lastInsertRowId;
}

export async function deleteDeck(id: number) {
  const db = await getDb();
  await db.runAsync("DELETE FROM decks WHERE id = ?", id);
}

export async function updateDeckName(id: number, name: string) {
  const db = await getDb();
  await db.runAsync("UPDATE decks SET name = ? WHERE id = ?", name, id);
}

export async function getDeckById(id: number) {
  const db = await getDb();
  return db.getFirstAsync<{ id: number; name: string; cards_study_per_day: number; created_at: number }>(
    "SELECT * FROM decks WHERE id = ?",
    id
  );
}

export async function updateDeckCardsStudyPerDay(id: number, cardsStudyPerDay: number) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE decks SET cards_study_per_day = ? WHERE id = ?",
    cardsStudyPerDay,
    id
  );
}

// ---------- Cards ----------

export async function getCardsForDeck(deckId: number) {
  const db = await getDb();
  return db.getAllAsync<{
    id: number;
    deck_id: number;
    front: string;
    back: string;
    front_lang: string;
    back_lang: string;
    front_image_uri?: string | null;
    back_image_uri?: string | null;
    front_bold?: number;
    back_bold?: number;
    front_underline?: number;
    back_underline?: number;
    bond_level?: string | null;
    known: number;
    created_at: number;
  }>("SELECT * FROM cards WHERE deck_id = ? ORDER BY id", deckId);
}

export async function insertCard(
  deckId: number,
  front: string,
  back: string,
  frontLang = "fr",
  backLang = "zh",
  options?: {
    frontImageUri?: string | null;
    backImageUri?: string | null;
    frontBold?: boolean;
    backBold?: boolean;
    frontUnderline?: boolean;
    backUnderline?: boolean;
  }
) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO cards (
      deck_id,
      front,
      back,
      front_lang,
      back_lang,
      front_image_uri,
      back_image_uri,
      front_bold,
      back_bold,
      front_underline,
      back_underline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    deckId,
    front,
    back,
    frontLang,
    backLang,
    options?.frontImageUri ?? null,
    options?.backImageUri ?? null,
    options?.frontBold ? 1 : 0,
    options?.backBold ? 1 : 0,
    options?.frontUnderline ? 1 : 0,
    options?.backUnderline ? 1 : 0
  );
  return result.lastInsertRowId;
}

export async function insertCards(
  deckId: number,
  cards: { front: string; back: string; front_lang?: string; back_lang?: string }[]
) {
  const db = await getDb();
  for (const c of cards) {
    await db.runAsync(
      "INSERT INTO cards (deck_id, front, back, front_lang, back_lang) VALUES (?, ?, ?, ?, ?)",
      deckId,
      c.front,
      c.back,
      c.front_lang ?? "fr",
      c.back_lang ?? "zh"
    );
  }
}

export async function updateCard(id: number, front: string, back: string) {
  const db = await getDb();
  await db.runAsync("UPDATE cards SET front = ?, back = ? WHERE id = ?", front, back, id);
}

export async function deleteCard(id: number) {
  const db = await getDb();
  await db.runAsync("DELETE FROM cards WHERE id = ?", id);
}

export async function setCardKnown(id: number, known: boolean) {
  const db = await getDb();
  await db.runAsync("UPDATE cards SET known = ? WHERE id = ?", known ? 1 : 0, id);
}

export async function setCardBondLevel(id: number, bondLevel: string) {
  const db = await getDb();
  await db.runAsync("UPDATE cards SET bond_level = ? WHERE id = ?", bondLevel, id);
}
