"""
应用配置
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """应用配置"""

    # 应用基本信息
    APP_NAME: str = "批量美颜工具"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # CORS配置
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # 数据目录配置
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    PERSONS_DIR: str = os.path.join(DATA_DIR, "persons")
    UPLOADS_DIR: str = os.path.join(DATA_DIR, "uploads")
    OUTPUTS_DIR: str = os.path.join(DATA_DIR, "outputs")

    # 数据库配置
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/beauty.db"

    # 文件上传限制
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: List[str] = [".jpg", ".jpeg", ".png", ".webp"]

    # 人脸检测配置
    FACE_DETECTION_CONFIDENCE: float = 0.5  # 人脸检测置信度阈值
    FACE_RECOGNITION_THRESHOLD: float = 0.4  # 人脸识别相似度阈值（越小越严格）

    # 磨皮默认参数
    DEFAULT_BEAUTIFY_STRENGTH: int = 50  # 默认磨皮强度 0-100
    DEFAULT_EDGE_PROTECTION: int = 70  # 默认边缘保护 0-100
    DEFAULT_DETAIL_PRESERVE: int = 60  # 默认细节保留 0-100

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
