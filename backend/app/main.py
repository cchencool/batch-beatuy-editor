"""
批量指定人员美颜工具 - 后端服务
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
import os

from app.core.config import settings
from app.api import persons, tasks, files
from app.models.database import init_db, async_session, Task


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化数据库、恢复中断任务、预热模型"""
    await init_db()

    # 服务重启后，残留的 processing 任务无法继续，标记为失败以允许重跑
    async with async_session() as db:
        result = await db.execute(select(Task).where(Task.status == "processing"))
        interrupted = result.scalars().all()
        for task in interrupted:
            task.status = "failed"
            task.error_message = "服务重启导致处理中断，可重新处理"
        if interrupted:
            await db.commit()

    # 后台线程预热模型，避免阻塞启动
    import asyncio
    from app.core.recognizer import warmup_model
    asyncio.get_running_loop().run_in_executor(None, warmup_model)

    yield


# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    description="批量指定人员美颜工具API",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保数据目录存在
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.PERSONS_DIR, exist_ok=True)
os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
os.makedirs(settings.OUTPUTS_DIR, exist_ok=True)

# 挂载静态文件目录
app.mount("/static/persons", StaticFiles(directory=settings.PERSONS_DIR), name="persons")
app.mount("/static/uploads", StaticFiles(directory=settings.UPLOADS_DIR), name="uploads")
app.mount("/static/outputs", StaticFiles(directory=settings.OUTPUTS_DIR), name="outputs")

# 注册路由
app.include_router(persons.router, prefix="/api/persons", tags=["人员管理"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["任务管理"])
app.include_router(files.router, prefix="/api/files", tags=["文件处理"])


@app.get("/")
async def root():
    """根路由"""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查（包含人脸识别模型状态，供前端提示）"""
    from app.core.recognizer import get_model_status
    return {
        "status": "healthy",
        "face_model": get_model_status(),
    }


def run():
    """运行服务器（用于uv run命令）"""
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )


if __name__ == "__main__":
    run()
