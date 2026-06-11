"""
应用配置
"""
from pydantic_settings import BaseSettings
from typing import List
import os
import json


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
    PATH_HISTORY_FILE: str = os.path.join(DATA_DIR, "path_history.json")
    SETTINGS_FILE: str = os.path.join(DATA_DIR, "settings.json")

    # 工作路径（可通过设置修改）
    WORK_DIR: str = os.path.expanduser("~/Development/debug/batch-beatuy-editor")

    # 默认路径
    DEFAULT_INPUT_DIR: str = os.path.expanduser("~/Downloads")
    DEFAULT_OUTPUT_DIR: str = os.path.join(DATA_DIR, "outputs")

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

    # 优化选项
    ENABLE_OPTIMIZATION: bool = True  # 默认开启降采样+ROI优化

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


def load_settings() -> dict:
    """从文件加载设置"""
    if os.path.exists(settings.SETTINGS_FILE):
        try:
            with open(settings.SETTINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {"work_dir": settings.WORK_DIR, "enable_optimization": settings.ENABLE_OPTIMIZATION}


def save_settings(data: dict):
    """保存设置到文件"""
    os.makedirs(os.path.dirname(settings.SETTINGS_FILE), exist_ok=True)
    with open(settings.SETTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_work_dir() -> str:
    """获取当前工作路径"""
    saved = load_settings()
    work_dir = saved.get("work_dir", settings.WORK_DIR)
    # 确保路径存在
    os.makedirs(work_dir, exist_ok=True)
    return work_dir


def is_safe_path(base_dir: str, target_path: str) -> bool:
    """检查目标路径是否在基础路径内（防止路径遍历攻击）"""
    try:
        base = os.path.realpath(base_dir)
        target = os.path.realpath(target_path)
        return target.startswith(base + os.sep) or target == base
    except Exception:
        return False
