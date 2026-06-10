"""
Pydantic数据模型（请求/响应）
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ============ 人员相关模型 ============

class PersonCreate(BaseModel):
    """创建人员请求"""
    name: str = Field(..., min_length=1, max_length=100, description="人员姓名")
    note: Optional[str] = Field(None, description="备注")


class PersonUpdate(BaseModel):
    """更新人员请求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    note: Optional[str] = None


class PersonResponse(BaseModel):
    """人员响应"""
    id: int
    name: str
    note: Optional[str]
    avatar_path: Optional[str]
    avatar_url: Optional[str] = None
    reference_photos: List[str]
    photo_urls: List[str] = []
    is_active: bool
    process_count: int
    last_process_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PersonListResponse(BaseModel):
    """人员列表响应"""
    persons: List[PersonResponse]
    total: int


# ============ 文件相关模型 ============

class FileInfo(BaseModel):
    """文件信息"""
    id: str  # 文件唯一标识
    filename: str
    original_path: str
    original_url: Optional[str] = None
    size: int
    extension: str
    thumbnail_path: Optional[str] = None
    thumbnail_url: Optional[str] = None


class FileUploadResponse(BaseModel):
    """文件上传响应"""
    files: List[FileInfo]
    total: int


# ============ 任务相关模型 ============

class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BeautifyParams(BaseModel):
    """美颜参数"""
    strength: int = Field(50, ge=0, le=100, description="磨皮强度 0-100")
    edge_protection: int = Field(70, ge=0, le=100, description="边缘保护 0-100")
    detail_preserve: int = Field(60, ge=0, le=100, description="细节保留 0-100")


class TaskCreate(BaseModel):
    """创建任务请求"""
    name: str = Field(..., min_length=1, max_length=200, description="任务名称")
    target_person_ids: List[int] = Field(..., min_length=1, description="目标人员ID列表")
    file_ids: List[str] = Field(default_factory=list, description="已上传文件ID列表")
    file_paths: List[str] = Field(default_factory=list, description="直接文件路径列表（来自输入目录）")
    params: BeautifyParams = Field(default_factory=BeautifyParams)
    input_dir: Optional[str] = Field(None, description="自定义输入目录（可选）")
    output_dir: Optional[str] = Field(None, description="自定义输出目录（可选）")


class ImageResult(BaseModel):
    """单张图片处理结果"""
    file_id: str
    filename: str
    status: str  # success, failed, no_target
    faces_detected: int = 0
    targets_matched: int = 0
    match_distance: Optional[float] = None
    output_path: Optional[str] = None
    output_url: Optional[str] = None
    thumbnail_path: Optional[str] = None
    thumbnail_url: Optional[str] = None
    process_time_ms: int = 0
    error_message: Optional[str] = None


class TaskProgress(BaseModel):
    """任务进度"""
    task_id: int
    status: TaskStatus
    total_count: int
    processed_count: int
    success_count: int
    failed_count: int
    no_target_count: int
    current_file: Optional[str] = None
    progress_percent: float = 0.0


class TaskResponse(BaseModel):
    """任务响应"""
    id: int
    name: str
    status: TaskStatus
    target_person_ids: List[int]
    beautify_strength: int
    edge_protection: int
    detail_preserve: int
    input_files: List[dict] = []
    total_count: int
    processed_count: int
    success_count: int
    failed_count: int
    no_target_count: int
    results: List[ImageResult]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    error_message: Optional[str]

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    """任务列表响应"""
    tasks: List[TaskResponse]
    total: int


# ============ 通用响应模型 ============

class MessageResponse(BaseModel):
    """消息响应"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """错误响应"""
    success: bool = False
    error: str
    detail: Optional[str] = None
