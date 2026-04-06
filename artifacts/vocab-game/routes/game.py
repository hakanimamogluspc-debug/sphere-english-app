import uuid
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db

try:
    from openai import AsyncOpenAI
    openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
    OPENAI_AVAILABLE = bool(os.environ.get("OPENAI_API_KEY"))
except Exception:
    openai_client = None
    OPENAI_AVAILABLE = False

router = APIRouter()


class StartGameRequest(BaseModel):
    username: str
    level: str = "mixed"
    words_count: int = 10


class GuessRequest(BaseModel):
    session_id: str
    word_id: int
    guess: str


@router.post("/game/start")
async def start_game(req: StartGameRequest):
    session_id = str(uuid.uuid4())
    async with get_db() as db:
        if req.level == "mixed":
            async with db.execute(
                "SELECT id FROM words ORDER BY RANDOM() LIMIT ?",
                (req.words_count,)
            ) as cur:
                word_ids = [r[0] for r in await cur.fetchall()]
        else:
            async with db.execute(
                "SELECT id FROM words WHERE level = ? ORDER BY RANDOM() LIMIT ?",
                (req.level, req.words_count)
            ) as cur:
                word_ids = [r[0] for r in await cur.fetchall()]

        if not word_ids:
            raise HTTPException(status_code=404, detail="Bu seviye için kelime bulunamadı.")

        await db.execute(
            "INSERT INTO game_sessions (id, username, level) VALUES (?, ?, ?)",
            (session_id, req.username, req.level)
        )
        for i, wid in enumerate(word_ids):
            await db.execute(
                "INSERT INTO session_words (session_id, word_id, word_index) VALUES (?, ?, ?)",
                (session_id, wid, i)
            )
        await db.commit()

    return {"session_id": session_id, "total_words": len(word_ids)}


@router.get("/game/word")
async def get_word(session_id: str):
    async with get_db() as db:
        async with db.execute(
            """SELECT sw.word_id, sw.word_index, w.image_prompt, w.level, w.category
               FROM session_words sw
               JOIN words w ON sw.word_id = w.id
               WHERE sw.session_id = ? AND sw.guessed_correctly = 0
               ORDER BY sw.word_index LIMIT 1""",
            (session_id,)
        ) as cur:
            row = await cur.fetchone()

        if not row:
            return {"done": True}

        async with db.execute(
            "SELECT score, words_seen, words_correct FROM game_sessions WHERE id = ?",
            (session_id,)
        ) as cur:
            sess = await cur.fetchone()

        async with db.execute(
            "SELECT COUNT(*) FROM session_words WHERE session_id = ?",
            (session_id,)
        ) as cur:
            total = (await cur.fetchone())[0]

    return {
        "done": False,
        "word_id": row[0],
        "word_index": row[1],
        "image_prompt": row[2],
        "level": row[3],
        "category": row[4],
        "current_score": sess[0] if sess else 0,
        "words_seen": sess[1] if sess else 0,
        "words_correct": sess[2] if sess else 0,
        "total_words": total,
    }


@router.post("/game/guess")
async def submit_guess(req: GuessRequest):
    async with get_db() as db:
        async with db.execute(
            """SELECT w.word, w.turkish, sw.hint_used, sw.attempts
               FROM session_words sw
               JOIN words w ON sw.word_id = w.id
               WHERE sw.session_id = ? AND sw.word_id = ?""",
            (req.session_id, req.word_id)
        ) as cur:
            row = await cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Kelime bulunamadı.")

        correct_word, turkish, hint_used, attempts = row[0], row[1], row[2], row[3]
        is_correct = req.guess.strip().lower() == correct_word.lower()
        attempts += 1
        score_gained = 0
        added_to_retry = False

        if is_correct:
            score_gained = 5 if hint_used else 10
            await db.execute(
                "UPDATE session_words SET guessed_correctly=1, attempts=? WHERE session_id=? AND word_id=?",
                (attempts, req.session_id, req.word_id)
            )
            await db.execute(
                "UPDATE game_sessions SET score=score+?, words_correct=words_correct+1, words_seen=words_seen+1 WHERE id=?",
                (score_gained, req.session_id)
            )
        else:
            await db.execute(
                "UPDATE session_words SET attempts=? WHERE session_id=? AND word_id=?",
                (attempts, req.session_id, req.word_id)
            )
            if attempts >= 3:
                added_to_retry = True
                await db.execute(
                    "UPDATE session_words SET guessed_correctly=1 WHERE session_id=? AND word_id=?",
                    (req.session_id, req.word_id)
                )
                await db.execute(
                    "INSERT OR IGNORE INTO retry_list (session_id, word_id) VALUES (?, ?)",
                    (req.session_id, req.word_id)
                )
                await db.execute(
                    "UPDATE game_sessions SET words_seen=words_seen+1 WHERE id=?",
                    (req.session_id,)
                )

        await db.commit()

    return {
        "correct": is_correct,
        "correct_word": correct_word if (not is_correct and attempts >= 3) else None,
        "turkish": turkish if (is_correct or (not is_correct and attempts >= 3)) else None,
        "score_gained": score_gained,
        "attempts": attempts,
        "added_to_retry": added_to_retry,
    }


@router.get("/game/hint")
async def get_hint(session_id: str, word_id: int):
    async with get_db() as db:
        async with db.execute(
            """SELECT w.word, w.turkish, w.category
               FROM session_words sw JOIN words w ON sw.word_id = w.id
               WHERE sw.session_id = ? AND sw.word_id = ?""",
            (session_id, word_id)
        ) as cur:
            row = await cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Kelime bulunamadı.")

        word, turkish, category = row[0], row[1], row[2]

        await db.execute(
            "UPDATE session_words SET hint_used=1 WHERE session_id=? AND word_id=?",
            (session_id, word_id)
        )
        await db.execute(
            "UPDATE game_sessions SET hints_used=hints_used+1 WHERE id=?",
            (session_id,)
        )
        await db.commit()

    hint = await _generate_hint(word, turkish, category)
    return {"hint": hint}


async def _generate_hint(word: str, turkish: str, category: str) -> str:
    if OPENAI_AVAILABLE and openai_client:
        try:
            resp = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful English vocabulary tutor. "
                            "Generate a single short hint (1-2 sentences) that helps someone guess an English word. "
                            "NEVER use the word itself, its plural/conjugated forms, or its direct Turkish translation in the hint."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Generate a helpful hint for the English word '{word}' "
                            f"(category: {category}, Turkish: {turkish}). "
                            f"Do NOT use '{word}' or '{turkish}' in the hint."
                        ),
                    },
                ],
                max_tokens=80,
                temperature=0.7,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI error: {e}")

    fallback_hints = {
        "animals": f"This is a living creature. Think about its size, habitat, and what it eats or how it moves.",
        "food": "You might find this in a kitchen or on a restaurant menu. Think about its taste, texture or colour.",
        "colors": "This is used to describe the appearance of objects and the world around us.",
        "technology": "This relates to modern devices or digital concepts used in everyday life.",
        "nature": "You can find this in the natural world, perhaps outdoors or in the environment.",
        "emotions": "This describes a feeling or mental state that people experience in everyday life.",
        "verbs": "This is an action — something a person or animal does.",
        "adjectives": "This is a describing word used to tell us more about a person, place or thing.",
        "places": "This is a location or type of building that people visit or live in.",
        "transport": "This is a vehicle or mode of getting from one place to another.",
    }
    return fallback_hints.get(category, f"This word belongs to the '{category}' category. Think about common vocabulary related to this topic!")


@router.post("/game/finish")
async def finish_game(session_id: str):
    async with get_db() as db:
        async with db.execute(
            "SELECT username, score, words_seen, words_correct, hints_used, level FROM game_sessions WHERE id = ?",
            (session_id,)
        ) as cur:
            sess = await cur.fetchone()

        if not sess:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı.")

        username, score, words_seen, words_correct, hints_used, level = sess

        await db.execute(
            "INSERT INTO leaderboard (username, score, level, words_correct, total_words) VALUES (?,?,?,?,?)",
            (username, score, level, words_correct, words_seen)
        )

        async with db.execute(
            """SELECT w.word, w.turkish, w.image_prompt
               FROM retry_list rl JOIN words w ON rl.word_id = w.id
               WHERE rl.session_id = ?""",
            (session_id,)
        ) as cur:
            retry_rows = await cur.fetchall()

        await db.commit()

    return {
        "username": username,
        "score": score,
        "words_correct": words_correct,
        "words_seen": words_seen,
        "hints_used": hints_used,
        "accuracy": round((words_correct / max(words_seen, 1)) * 100),
        "retry_list": [{"word": r[0], "turkish": r[1], "image_prompt": r[2]} for r in retry_rows],
    }


@router.get("/game/retry-list")
async def get_retry_list(session_id: str):
    async with get_db() as db:
        async with db.execute(
            """SELECT w.id, w.word, w.turkish, w.image_prompt, w.level, w.category
               FROM retry_list rl JOIN words w ON rl.word_id = w.id
               WHERE rl.session_id = ?""",
            (session_id,)
        ) as cur:
            rows = await cur.fetchall()

    return {
        "retry_words": [
            {"id": r[0], "word": r[1], "turkish": r[2], "image_prompt": r[3], "level": r[4], "category": r[5]}
            for r in rows
        ]
    }


@router.get("/game/words")
async def get_word_list(level: str = "all", category: str = "all", limit: int = 20, offset: int = 0):
    async with get_db() as db:
        conditions = []
        params = []
        if level != "all":
            conditions.append("level = ?")
            params.append(level)
        if category != "all":
            conditions.append("category = ?")
            params.append(category)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        async with db.execute(
            f"SELECT id, word, turkish, level, category FROM words {where} ORDER BY frequency_rank LIMIT ? OFFSET ?",
            params + [limit, offset]
        ) as cur:
            rows = await cur.fetchall()
        async with db.execute(f"SELECT COUNT(*) FROM words {where}", params) as cur:
            total = (await cur.fetchone())[0]

    return {
        "words": [{"id": r[0], "word": r[1], "turkish": r[2], "level": r[3], "category": r[4]} for r in rows],
        "total": total,
    }
