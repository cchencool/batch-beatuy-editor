"""
批量指定人员美颜工具 - 后端服务
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.api import persons, tasks, files
from app.models.database import init_db

# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    description="批量指定人员美颜工具API",
    version="1.0.0",
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


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库"""
    await init_db()


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
    """健康检查"""
    return {"status": "healthy"}
