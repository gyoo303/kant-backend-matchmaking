from fastapi import FastAPI

app = FastAPI(
    title="2vs2 매치메이킹",
    description="2vs2 공개 방을 만들거나 참가하고, 방장이 게임을 시작하면 방이 해산된다.",
    version="0.1.0",
)
