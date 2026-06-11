"""
文件处理API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
import os
import uuid
import shutil
import json
from pathlib import Path

from app.models.schemas import FileInfo, FileUploadResponse, MessageResponse
from app.core.config import settings, load_settings, save_settings, get_work_dir, is_safe_path

router = APIRouter()

# 文件存储（持久化到磁盘，避免重启丢失）
UPLOADED_FILES_JSON = os.path.join(settings.DATA_DIR, "uploaded_files.json")
uploaded_files = {}


def _load_uploaded_files():
    """从磁盘加载已上传文件信息"""
    global uploaded_files
    if os.path.exists(UPLOADED_FILES_JSON):
        try:
            with open(UPLOADED_FILES_JSON, 'r', encoding='utf-8') as f:
                data = json.load(f)
                uploaded_files = {k: FileInfo(**v) for k, v in data.items()}
        except Exception:
            uploaded_files = {}


def _save_uploaded_files():
    """保存已上传文件信息到磁盘"""
    os.makedirs(os.path.dirname(UPLOADED_FILES_JSON), exist_ok=True)
    with open(UPLOADED_FILES_JSON, 'w', encoding='utf-8') as f:
        json.dump({k: v.model_dump() for k, v in uploaded_files.items()}, f, ensure_ascii=False, indent=2)


# 启动时加载
_load_uploaded_files()


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


# ============ 固定路径路由（必须在 /{file_id} 之前） ============

@router.post("/upload", response_model=FileUploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    """上传文件"""
    uploaded = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            continue

        file_id = uuid.uuid4().hex
        saved_filename = f"{file_id}{ext}"
        save_path = os.path.join(settings.UPLOADS_DIR, saved_filename)

        with open(save_path, "wb") as f:
            content = await file.read()
            f.write(content)

        thumb_dir = os.path.join(settings.UPLOADS_DIR, "thumbnails")
        os.makedirs(thumb_dir, exist_ok=True)
        thumb_path = os.path.join(thumb_dir, f"{file_id}_thumb{ext}")

        try:
            from PIL import Image
            img = Image.open(save_path)
            img.thumbnail((200, 200))
            img.save(thumb_path)
        except Exception:
            thumb_path = None

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

    _save_uploaded_files()
    return FileUploadResponse(files=uploaded, total=len(uploaded))


@router.post("/upload-folder", response_model=FileUploadResponse)
async def upload_folder(files: List[UploadFile] = File(...)):
    """上传文件夹（保持目录结构）"""
    return await upload_files(files)


@router.get("/list", response_model=FileUploadResponse)
async def list_files():
    """获取已上传文件列表"""
    files = [_file_to_response(f) for f in uploaded_files.values()]
    return FileUploadResponse(files=files, total=len(files))


@router.delete("/", response_model=MessageResponse)
async def clear_all_files():
    """清空所有已上传文件"""
    for file_id, file_info in list(uploaded_files.items()):
        if os.path.exists(file_info.original_path):
            os.remove(file_info.original_path)
        if file_info.thumbnail_path and os.path.exists(file_info.thumbnail_path):
            os.remove(file_info.thumbnail_path)

    uploaded_files.clear()
    _save_uploaded_files()

    return MessageResponse(success=True, message="所有文件已清空")


@router.get("/scan")
async def scan_directory(path: str = "/"):
    """扫描目录中的图片文件，返回可选择的文件列表"""
    from pydantic import BaseModel

    class DirScanResult(BaseModel):
        path: str
        exists: bool
        is_dir: bool
        files: List[dict]

    path = os.path.expanduser(path) if '~' in path else os.path.abspath(path)

    if not os.path.exists(path):
        return DirScanResult(path=path, exists=False, is_dir=False, files=[])

    if not os.path.isdir(path):
        return DirScanResult(path=path, exists=True, is_dir=False, files=[])

    allowed_ext = {'.jpg', '.jpeg', '.png', '.webp'}
    files = []
    try:
        for f in sorted(os.listdir(path)):
            full_path = os.path.join(path, f)
            if os.path.isfile(full_path) and os.path.splitext(f)[1].lower() in allowed_ext:
                file_id = f"dir_{uuid.uuid4().hex[:8]}"
                files.append({
                    "id": file_id,
                    "name": f,
                    "path": full_path,
                    "size": os.path.getsize(full_path),
                    "extension": os.path.splitext(f)[1].lower(),
                })
    except PermissionError:
        pass

    return DirScanResult(path=path, exists=True, is_dir=True, files=files)


@router.get("/list-dirs")
async def list_directories(path: str = "/"):
    """列出目录下的子目录，支持向上导航"""
    from pydantic import BaseModel

    class DirListResult(BaseModel):
        current: str
        parent: str | None
        dirs: List[dict]

    path = os.path.expanduser(path) if '~' in path else os.path.abspath(path)

    if not os.path.exists(path) or not os.path.isdir(path):
        return DirListResult(current=path, parent=None, dirs=[])

    parent = os.path.dirname(path) if path != "/" else None

    dirs = []
    try:
        for f in sorted(os.listdir(path)):
            full_path = os.path.join(path, f)
            if os.path.isdir(full_path) and not f.startswith('.'):
                dirs.append({
                    "name": f,
                    "path": full_path,
                })
    except PermissionError:
        pass

    return DirListResult(current=path, parent=parent, dirs=dirs)


# ============ 应用设置 ============

@router.get("/settings")
async def get_app_settings():
    """获取应用设置"""
    saved = load_settings()
    return {
        "work_dir": saved.get("work_dir", settings.WORK_DIR),
    }


@router.post("/settings")
async def update_app_settings(body: dict):
    """更新应用设置"""
    work_dir = body.get("work_dir", "").strip()
    if not work_dir:
        raise HTTPException(status_code=400, detail="工作路径不能为空")

    work_dir = os.path.expanduser(work_dir) if '~' in work_dir else os.path.abspath(work_dir)

    if not os.path.exists(work_dir):
        os.makedirs(work_dir, exist_ok=True)

    save_settings({"work_dir": work_dir})
    return {"success": True, "work_dir": work_dir}


# ============ 安全的目录浏览（限制在工作路径内） ============

@router.get("/work-dirs")
async def list_work_dirs(path: str = ""):
    """列出工作路径下的子目录（安全限制）"""
    from pydantic import BaseModel

    class DirListResult(BaseModel):
        current: str
        parent: str | None
        dirs: List[dict]

    work_dir = get_work_dir()

    if not path:
        path = work_dir
    else:
        path = os.path.expanduser(path) if '~' in path else os.path.abspath(path)

    if not is_safe_path(work_dir, path):
        return DirListResult(current=work_dir, parent=None, dirs=[])

    if not os.path.exists(path) or not os.path.isdir(path):
        return DirListResult(current=path, parent=None, dirs=[])

    parent = os.path.dirname(path)
    if not is_safe_path(work_dir, parent):
        parent = None

    dirs = []
    try:
        for f in sorted(os.listdir(path)):
            full_path = os.path.join(path, f)
            if os.path.isdir(full_path) and not f.startswith('.'):
                dirs.append({"name": f, "path": full_path})
    except PermissionError:
        pass

    return DirListResult(current=path, parent=parent, dirs=dirs)


# ============ 缩略图生成 ============

@router.post("/thumbnails")
async def generate_thumbnails(body: dict):
    """为目录中的图片生成缩略图"""
    from pydantic import BaseModel

    class ThumbResult(BaseModel):
        success: bool
        count: int
        thumb_dir: str

    dir_path = body.get("path", "").strip()
    if not dir_path:
        raise HTTPException(status_code=400, detail="路径不能为空")

    dir_path = os.path.expanduser(dir_path) if '~' in dir_path else os.path.abspath(dir_path)

    work_dir = get_work_dir()
    if not is_safe_path(work_dir, dir_path):
        raise HTTPException(status_code=400, detail="路径不在工作目录内")

    if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
        return ThumbResult(success=False, count=0, thumb_dir="")

    thumb_dir = os.path.join(work_dir, "thumbnails", os.path.basename(dir_path))
    os.makedirs(thumb_dir, exist_ok=True)

    allowed_ext = {'.jpg', '.jpeg', '.png', '.webp'}
    count = 0

    try:
        from PIL import Image

        for f in sorted(os.listdir(dir_path)):
            ext = os.path.splitext(f)[1].lower()
            if ext not in allowed_ext:
                continue

            src_path = os.path.join(dir_path, f)
            if not os.path.isfile(src_path):
                continue

            thumb_name = f"{os.path.splitext(f)[0]}_thumb.jpg"
            thumb_path = os.path.join(thumb_dir, thumb_name)

            if os.path.exists(thumb_path):
                count += 1
                continue

            try:
                from PIL import ImageOps
                with Image.open(src_path) as img:
                    img = ImageOps.exif_transpose(img) or img
                    img.thumbnail((200, 200))
                    img.save(thumb_path, "JPEG", quality=85)
                    count += 1
            except Exception:
                continue
    except ImportError:
        pass

    return ThumbResult(success=True, count=count, thumb_dir=thumb_dir)


@router.get("/thumb")
async def get_thumbnail(path: str):
    """获取图片缩略图（如果不存在则返回原图）"""
    from fastapi.responses import FileResponse

    path = os.path.expanduser(path) if '~' in path else os.path.abspath(path)

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 在工作路径的 thumbnails 目录中查找缩略图
    work_dir = get_work_dir()
    thumb_dir = os.path.join(work_dir, "thumbnails")

    if os.path.isdir(thumb_dir):
        filename = os.path.basename(path)
        name_without_ext = os.path.splitext(filename)[0]
        thumb_name = f"{name_without_ext}_thumb.jpg"

        for sub in os.listdir(thumb_dir):
            thumb_path = os.path.join(thumb_dir, sub, thumb_name)
            if os.path.exists(thumb_path):
                return FileResponse(thumb_path)

    # 没有缩略图，返回原图
    return FileResponse(path)


@router.get("/image")
async def get_image(path: str):
    """获取原始图片（支持任意路径）"""
    from fastapi.responses import FileResponse

    path = os.path.expanduser(path) if '~' in path else os.path.abspath(path)

    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(path)


# ============ 路径历史管理 ============

def _load_path_history() -> dict:
    """加载路径历史"""
    if os.path.exists(settings.PATH_HISTORY_FILE):
        try:
            with open(settings.PATH_HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {"input": [], "output": []}


def _save_path_history(data: dict):
    """保存路径历史"""
    os.makedirs(os.path.dirname(settings.PATH_HISTORY_FILE), exist_ok=True)
    with open(settings.PATH_HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/paths")
async def get_paths():
    """获取保存的路径列表和默认路径"""
    history = _load_path_history()
    return {
        "default_input": settings.DEFAULT_INPUT_DIR,
        "default_output": settings.DEFAULT_OUTPUT_DIR,
        "input_paths": history.get("input", []),
        "output_paths": history.get("output", []),
    }


@router.post("/paths")
async def save_path(body: dict):
    """保存一个路径到历史记录"""
    path = body.get("path", "").strip()
    path_type = body.get("type", "input")

    if not path or path_type not in ("input", "output"):
        raise HTTPException(status_code=400, detail="无效的参数")

    history = _load_path_history()
    paths = history.get(path_type, [])

    if path in paths:
        paths.remove(path)
    paths.insert(0, path)

    history[path_type] = paths[:20]
    _save_path_history(history)

    return {"success": True, "paths": history[path_type]}


@router.delete("/paths")
async def delete_path(body: dict):
    """删除一个路径"""
    path = body.get("path", "").strip()
    path_type = body.get("type", "input")

    if not path or path_type not in ("input", "output"):
        raise HTTPException(status_code=400, detail="无效的参数")

    history = _load_path_history()
    paths = history.get(path_type, [])
    if path in paths:
        paths.remove(path)
        history[path_type] = paths
        _save_path_history(history)

    return {"success": True, "paths": history[path_type]}


@router.put("/paths/reorder")
async def reorder_paths(body: dict):
    """重排路径顺序"""
    paths = body.get("paths", [])
    path_type = body.get("type", "input")

    if path_type not in ("input", "output"):
        raise HTTPException(status_code=400, detail="无效的参数")

    history = _load_path_history()
    history[path_type] = paths
    _save_path_history(history)

    return {"success": True, "paths": paths}


@router.get("/serve")
async def serve_file(path: str):
    """从任意路径提供文件（用于自定义输出目录）"""
    from fastapi.responses import FileResponse

    # 安全检查：只允许读取图片文件
    allowed_ext = {'.jpg', '.jpeg', '.png', '.webp', '.thumb.jpg'}
    ext = os.path.splitext(path)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="不支持的文件类型")

    if not os.path.exists(path) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(path)


# ============ 参数化路由（必须在最后） ============

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

    if os.path.exists(file_info.original_path):
        os.remove(file_info.original_path)
    if file_info.thumbnail_path and os.path.exists(file_info.thumbnail_path):
        os.remove(file_info.thumbnail_path)

    del uploaded_files[file_id]
    _save_uploaded_files()

    return MessageResponse(success=True, message="文件已删除")


def get_file_by_id(file_id: str) -> FileInfo:
    """根据ID获取文件信息（供内部使用）"""
    return uploaded_files.get(file_id)
