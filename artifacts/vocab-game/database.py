import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "vocab_game.db")


def get_db():
    return aiosqlite.connect(DB_PATH)


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                turkish TEXT NOT NULL,
                image_prompt TEXT NOT NULL,
                level TEXT NOT NULL DEFAULT 'A1',
                category TEXT NOT NULL DEFAULT 'general',
                frequency_rank INTEGER
            );

            CREATE TABLE IF NOT EXISTS game_sessions (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                level TEXT NOT NULL,
                score INTEGER DEFAULT 0,
                words_seen INTEGER DEFAULT 0,
                words_correct INTEGER DEFAULT 0,
                hints_used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS session_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                word_id INTEGER NOT NULL,
                word_index INTEGER DEFAULT 0,
                guessed_correctly INTEGER DEFAULT 0,
                attempts INTEGER DEFAULT 0,
                hint_used INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS retry_list (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                word_id INTEGER NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS leaderboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                score INTEGER NOT NULL,
                level TEXT NOT NULL,
                words_correct INTEGER NOT NULL,
                total_words INTEGER NOT NULL,
                session_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await db.commit()

        async with db.execute("SELECT COUNT(*) FROM words") as cursor:
            row = await cursor.fetchone()
            count = row[0]

        if count == 0:
            from seed_words import WORDS_DATA
            await db.executemany(
                "INSERT OR IGNORE INTO words (word, turkish, image_prompt, level, category, frequency_rank) VALUES (?, ?, ?, ?, ?, ?)",
                WORDS_DATA
            )
            await db.commit()
            print(f"✅ {len(WORDS_DATA)} kelime veritabanına eklendi.")
