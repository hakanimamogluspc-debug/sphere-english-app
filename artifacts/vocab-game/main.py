import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import init_db
from routes.game import router as game_router
from routes.scores import router as scores_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Sphere English — Vocab Game", lifespan=lifespan)

app.include_router(game_router, prefix="/api")
app.include_router(scores_router, prefix="/api")

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "public")
app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")


@app.get("/")
@app.get("/{path:path}")
async def serve_spa(path: str = ""):
    index = os.path.join(PUBLIC_DIR, "index.html")
    return FileResponse(index)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8090))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
