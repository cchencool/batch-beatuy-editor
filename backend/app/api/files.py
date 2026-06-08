"""
文件处理API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import os
import uuid
import shutil
from pathlib import Path

from app.models.schemas import FileInfo, FileUploadResponse, MessageResponse
from app.core.config import settings

router = APIRouter()

# 内存中的文件存储（实际生产环境应使用数据库或Redis）
uploaded_files = {}


def _path_to_url(path: str) -> str:
    """将绝对路径转换为静态文件URL"""
    if not path:
        return ""
    for name, base_dir in [
        ("persons", settings.PERSONS_DIR),
        ("uploads", settings.UPLOADS_DIR),
        ("outputs", settings.OUTPUTS_DIR),
    ]:
        if path.startswith(base_dir):
            relative = os.path.relpath(path, base_dir)
            return f"/static/{name}/{relative}"
    return f"/static/uploads/{os.path.basename(path)}"


def _file_to_response(file_info: FileInfo) -> FileInfo:
    """为文件信息计算URL字段"""
    return FileInfo(
        id=file_info.id,
        filename=file_info.filename,
        original_path=file_info.original_path,
        original_url=_path_to_url(file_info.original_path),
        size=file_info.size,
        extension=file_info.extension,
        thumbnail_path=file_info.thumbnail_path,
        thumbnail_url=_path_to_url(file_info.thumbnail_path) if file_info.thumbnail_path else None,
    )


@router.post("/upload", response_model=FileUploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    """上传文件"""
    uploaded = []

    for file in files:
        # 检查文件扩展名
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            continue

        # 生成唯一ID
        file_id = uuid.uuid4().hex
        saved_filename = f"{file_id}{ext}"
        save_path = os.path.join(settings.UPLOADS_DIR, saved_filename)

        # 保存文件
        with open(save_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # 创建缩略图目录
        thumb_dir = os.path.join(settings.UPLOADS_DIR, "thumbnails")
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_path = os.path.join(thumb_dir, f"{file_id}_thumb{ext}")

        # 生成缩略图
        try:
            from PIL import Image
            img = Image.open(save_path)
            img.thumbnail((200, 200))
            img.save(thumb_path)
        except Exception:
            thumb_path = None

        # 记录文件信息
        file_info = FileInfo(
            id=file_id,
            filename=file.filename,
            original_path=save_path,
            size=os.path.getsize(save_path),
            extension=ext,
            thumbnail_path=thumb_path
        )
        file_info_with_url = _file_to_response(file_info)

        uploaded_files[file_id] = file_info
        uploaded.append(file_info_with_url)

    return FileUploadResponse(files=uploaded, total=len(uploaded))


@router.post("/upload-folder", response_model=FileUploadResponse)
async def upload_folder(files: List[UploadFile] = File(...)):
    """上传文件夹（保持目录结构）"""
    # 与upload_files相同，但保留文件路径信息
    return await upload_files(files)


@router.get("/list", response_model=FileUploadResponse)
async def list_files():
    """获取已上传文件列表"""
    files = [_file_to_response(f) for f in uploaded_files.values()]
    return FileUploadResponse(files=files, total=len(files))


@router.get("/{file_id}", response_model=FileInfo)
async def get_file(file_id: str):
    """获取文件信息"""
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail="文件不存在")
    return _file_to_response(uploaded_files[file_id])


@router.delete("/{file_id}", response_model=MessageResponse)
async def delete_file(file_id: str):
    """删除文件"""
    if file_id not in uploaded_files:
        raise HTTPException(status_code=404, detail="文件不存在")

    file_info = uploaded_files[file_id]

    # 删除文件
    if os.path.exists(file_info.original_path):
        os.remove(file_info.original_path)
    if file_info.thumbnail_path and os.path.exists(file_info.thumbnail_path):
        os.remove(file_info.thumbnail_path)

    del uploaded_files[file_id]

    return MessageResponse(success=True, message="文件已删除")


@router.delete("/", response_model=MessageResponse)
async def clear_all_files():
    """清空所有已上传文件"""
    for file_id, file_info in list(uploaded_files.items()):
        if os.path.exists(file_info.original_path):
            os.remove(file_info.original_path)
        if file_info.thumbnail_path and os.path.exists(file_info.thumbnail_path):
            os.remove(file_info.thumbnail_path)

    uploaded_files.clear()

    return MessageResponse(success=True, message="所有文件已清空")


def get_file_by_id(file_id: str) -> FileInfo:
    """根据ID获取文件信息（供内部使用）"""
    return uploaded_files.get(file_id)
