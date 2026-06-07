"""
数据库模型和初始化
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, Text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime
import os

from app.core.config import settings

# 创建异步引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
)

# 创建会话工厂
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 创建基类
Base = declarative_base()


class Person(Base):
    """目标人员表"""
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    note = Column(Text, nullable=True)
    avatar_path = Column(String(500), nullable=True)  # 头像路径（第一张参考照）
    reference_photos = Column(JSON, default=list)  # 参考照片路径列表
    face_embeddings = Column(JSON, default=list)  # 人脸embedding缓存路径
    is_active = Column(Boolean, default=True)
    process_count = Column(Integer, default=0)  # 被处理次数
    last_process_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Task(Base):
    """处理任务表"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed, cancelled
    target_person_ids = Column(JSON, default=list)  # 目标人员ID列表

    # 参数配置
    beautify_strength = Column(Integer, default=50)
    edge_protection = Column(Integer, default=70)
    detail_preserve = Column(Integer, default=60)

    # 文件信息
    input_files = Column(JSON, default=list)  # 输入文件列表
    output_dir = Column(String(500), nullable=True)  # 输出目录

    # 进度和统计
    total_count = Column(Integer, default=0)
    processed_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    no_target_count = Column(Integer, default=0)  # 未检测到目标的图片数

    # 处理结果详情
    results = Column(JSON, default=list)  # 每张图的处理结果

    # 时间信息
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 错误信息
    error_message = Column(Text, nullable=True)


async def init_db():
    """初始化数据库"""
    # 确保数据目录存在
    os.makedirs(settings.DATA_DIR, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """获取数据库会话"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
