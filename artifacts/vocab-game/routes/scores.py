from fastapi import APIRouter
from database import get_db

router = APIRouter()


@router.get("/scores/leaderboard")
async def get_leaderboard(level: str = "all", limit: int = 10):
    async with get_db() as db:
        if level == "all":
            async with db.execute(
                """SELECT username, score, level, words_correct, total_words, session_date
                   FROM leaderboard ORDER BY score DESC LIMIT ?""",
                (limit,)
            ) as cur:
                rows = await cur.fetchall()
        else:
            async with db.execute(
                """SELECT username, score, level, words_correct, total_words, session_date
                   FROM leaderboard WHERE level = ? ORDER BY score DESC LIMIT ?""",
                (level, limit)
            ) as cur:
                rows = await cur.fetchall()

    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "username": r[0],
                "score": r[1],
                "level": r[2],
                "words_correct": r[3],
                "total_words": r[4],
                "date": r[5],
            }
            for i, r in enumerate(rows)
        ]
    }


@router.get("/scores/stats")
async def get_stats():
    async with get_db() as db:
        async with db.execute("SELECT COUNT(*) FROM words") as cur:
            total_words = (await cur.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM leaderboard") as cur:
            total_games = (await cur.fetchone())[0]
        async with db.execute("SELECT MAX(score) FROM leaderboard") as cur:
            row = await cur.fetchone()
            high_score = row[0] if row[0] else 0
        async with db.execute("SELECT COUNT(DISTINCT level) FROM words") as cur:
            levels = (await cur.fetchone())[0]
        async with db.execute("SELECT COUNT(DISTINCT category) FROM words") as cur:
            categories = (await cur.fetchone())[0]

    return {
        "total_words": total_words,
        "total_games": total_games,
        "high_score": high_score,
        "levels": levels,
        "categories": categories,
    }
