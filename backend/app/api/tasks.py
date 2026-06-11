"""
任务管理API
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
import asyncio
import os
import json
import zipfile
import uuid

from app.models.database import Task, Person, get_db
from app.models.schemas import (
    TaskCreate, TaskResponse, TaskListResponse, TaskProgress,
    ImageResult, MessageResponse, BeautifyParams
)
from app.api.files import get_file_by_id
from app.core.config import settings

router = APIRouter()

# 正在处理的任务
processing_tasks = {}


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


def _result_to_image_result(r: dict) -> ImageResult:
    """将数据库中的结果字典转换为ImageResult对象"""
    return ImageResult(
        file_id=r.get("file_id", ""),
        filename=r.get("filename", ""),
        status=r.get("status", "failed"),
        faces_detected=r.get("faces_detected", 0),
        targets_matched=r.get("targets_matched", 0),
        match_distance=r.get("match_distance"),
        face_bboxes=r.get("face_bboxes"),
        output_path=r.get("output_path"),
        output_url=_path_to_url(r["output_path"]) if r.get("output_path") else None,
        thumbnail_path=r.get("thumbnail_path"),
        thumbnail_url=_path_to_url(r["thumbnail_path"]) if r.get("thumbnail_path") else None,
        process_time_ms=r.get("process_time_ms", 0),
        error_message=r.get("error_message"),
    )


def _task_to_response(task: Task) -> TaskResponse:
    """将Task模型转换为TaskResponse"""
    results = []
    if task.results:
        if isinstance(task.results, str):
            try:
                task.results = json.loads(task.results)
            except Exception:
                task.results = []
        for r in task.results:
            if isinstance(r, dict):
                results.append(_result_to_image_result(r))
            else:
                results.append(r)

    # 解析 input_files
    input_files = task.input_files or []
    if isinstance(input_files, str):
        try:
            input_files = json.loads(input_files)
        except Exception:
            input_files = []

    return TaskResponse(
        id=task.id,
        name=task.name,
        status=task.status,
        target_person_ids=task.target_person_ids or [],
        beautify_strength=task.beautify_strength,
        edge_protection=task.edge_protection,
        detail_preserve=task.detail_preserve,
        input_files=input_files,
        total_count=task.total_count,
        processed_count=task.processed_count,
        success_count=task.success_count,
        failed_count=task.failed_count,
        no_target_count=task.no_target_count,
        results=results,
        started_at=task.started_at,
        completed_at=task.completed_at,
        created_at=task.created_at,
        error_message=task.error_message,
    )


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取任务列表"""
    query = select(Task)

    if status:
        query = query.where(Task.status == status)

    query = query.order_by(Task.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    tasks = result.scalars().all()

    # 获取总数
    count_query = select(func.count()).select_from(Task)
    if status:
        count_query = count_query.where(Task.status == status)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    return TaskListResponse(tasks=[_task_to_response(t) for t in tasks], total=total)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """获取任务详情"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return _task_to_response(task)


@router.get("/{task_id}/progress", response_model=TaskProgress)
async def get_task_progress(task_id: int, db: AsyncSession = Depends(get_db)):
    """获取任务进度"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    progress = (task.processed_count / task.total_count * 100) if task.total_count > 0 else 0

    return TaskProgress(
        task_id=task.id,
        status=task.status,
        total_count=task.total_count,
        processed_count=task.processed_count,
        success_count=task.success_count,
        failed_count=task.failed_count,
        no_target_count=task.no_target_count,
        progress_percent=progress
    )


@router.post("/", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """创建批量处理任务"""
    # 验证目标人员存在
    for person_id in task_data.target_person_ids:
        result = await db.execute(select(Person).where(Person.id == person_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"人员ID {person_id} 不存在")

    # 验证文件存在（支持 file_ids 和 file_paths 两种方式）
    input_files = []
    for file_id in task_data.file_ids:
        file_info = get_file_by_id(file_id)
        if file_info:
            input_files.append({
                "id": file_info.id,
                "filename": file_info.filename,
                "path": file_info.original_path
            })
    for file_path in task_data.file_paths:
        if os.path.isfile(file_path):
            input_files.append({
                "id": os.path.splitext(os.path.basename(file_path))[0],
                "filename": os.path.basename(file_path),
                "path": file_path
            })

    if not input_files:
        raise HTTPException(status_code=400, detail="没有有效的输入文件")

    # 创建输出目录
    if task_data.output_dir:
        output_dir = task_data.output_dir
        os.makedirs(output_dir, exist_ok=True)
    else:
        output_dir = os.path.join(
            settings.OUTPUTS_DIR,
            f"{datetime.now().strftime('%Y-%m-%d')}_{task_data.name}_{datetime.now().strftime('%H-%M-%S')}"
        )
        os.makedirs(output_dir, exist_ok=True)

    # 创建任务
    task = Task(
        name=task_data.name,
        status="pending",
        target_person_ids=task_data.target_person_ids,
        beautify_strength=task_data.params.strength,
        edge_protection=task_data.params.edge_protection,
        detail_preserve=task_data.params.detail_preserve,
        input_files=input_files,
        input_dir=task_data.input_dir,
        output_dir=output_dir,
        total_count=len(input_files),
        results=[]
    )

    db.add(task)
    await db.commit()
    await db.refresh(task)

    # 在后台启动处理
    background_tasks.add_task(process_task_background, task.id)

    return _task_to_response(task)


@router.post("/{task_id}/start", response_model=MessageResponse)
async def start_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """启动任务"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status == "processing":
        raise HTTPException(status_code=400, detail="任务正在处理中")

    task.status = "pending"
    task.processed_count = 0
    task.success_count = 0
    task.failed_count = 0
    task.no_target_count = 0
    task.results = []
    await db.commit()

    background_tasks.add_task(process_task_background, task.id)

    return MessageResponse(success=True, message="任务已启动")


@router.post("/{task_id}/pause", response_model=MessageResponse)
async def pause_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """暂停任务"""
    if task_id in processing_tasks:
        processing_tasks[task_id]["pause"] = True
        return MessageResponse(success=True, message="任务暂停请求已发送")

    return MessageResponse(success=False, message="任务不在处理中")


@router.post("/{task_id}/cancel", response_model=MessageResponse)
async def cancel_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """取消任务"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task_id in processing_tasks:
        processing_tasks[task_id]["cancel"] = True

    task.status = "cancelled"
    await db.commit()

    return MessageResponse(success=True, message="任务已取消")


@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """删除任务"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status == "processing":
        raise HTTPException(status_code=400, detail="不能删除正在处理的任务")

    # 删除输出目录
    if task.output_dir and os.path.exists(task.output_dir):
        import shutil
        shutil.rmtree(task.output_dir)

    await db.delete(task)
    await db.commit()

    return MessageResponse(success=True, message="任务已删除")


@router.get("/{task_id}/download")
async def download_results(task_id: int, db: AsyncSession = Depends(get_db)):
    """下载处理结果（ZIP压缩包）"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status != "completed":
        raise HTTPException(status_code=400, detail="任务尚未完成")

    if not task.output_dir or not os.path.exists(task.output_dir):
        raise HTTPException(status_code=404, detail="输出目录不存在")

    # 创建ZIP文件
    zip_path = os.path.join(settings.OUTPUTS_DIR, f"task_{task_id}_results.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(task.output_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, task.output_dir)
                zipf.write(file_path, arcname)

    return FileResponse(
        zip_path,
        filename=f"task_{task_id}_results.zip",
        media_type="application/zip"
    )


async def process_task_background(task_id: int):
    """后台处理任务"""
    import logging
    logger = logging.getLogger(__name__)
    from app.models.database import async_session

    loop = asyncio.get_running_loop()

    # 初始化处理控制
    processing_tasks[task_id] = {"pause": False, "cancel": False}

    try:
        async with async_session() as db:
            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()

            if not task:
                logger.error(f"Task {task_id} not found")
                return

            # 更新状态为处理中
            task.status = "processing"
            task.started_at = datetime.utcnow()
            await db.commit()

            # 获取目标人员信息
            persons_result = await db.execute(
                select(Person).where(Person.id.in_(task.target_person_ids))
            )
            persons = persons_result.scalars().all()

            # 导入核心处理模块
            from app.core.pipeline import BeautyPipeline
            from concurrent.futures import ThreadPoolExecutor, as_completed

            # 整个处理逻辑在线程池中执行，避免阻塞事件循环
            def _process_all():
                from app.core.config import load_settings
                _cfg = load_settings()
                _enable_opt = _cfg.get("enable_optimization", True)

                pipeline = BeautyPipeline(
                    persons=persons,
                    strength=task.beautify_strength,
                    edge_protection=task.edge_protection,
                    detail_preserve=task.detail_preserve,
                    enable_optimization=_enable_opt
                )

                def process_one(file_info):
                    """处理单张图片（由线程池调度）"""
                    if processing_tasks[task_id]["cancel"]:
                        return None
                    while processing_tasks[task_id]["pause"]:
                        import time
                        time.sleep(0.5)
                        if processing_tasks[task_id]["cancel"]:
                            return None
                    try:
                        return pipeline.process_image(
                            file_info["path"],
                            task.output_dir
                        )
                    except Exception as e:
                        logger.error(f"Failed to process {file_info['filename']}: {e}")
                        return {
                            "file_id": file_info["id"],
                            "filename": file_info["filename"],
                            "status": "failed",
                            "error_message": str(e)
                        }

                results = []
                files = [f for f in task.input_files]
                batch_size = min(4, os.cpu_count() or 4)

                with ThreadPoolExecutor(max_workers=batch_size) as pool:
                    futures = {pool.submit(process_one, f): f for f in files}
                    for future in as_completed(futures):
                        r = future.result()
                        if r is not None:
                            results.append(r)
                        # 检查取消
                        if processing_tasks[task_id]["cancel"]:
                            for f in futures:
                                f.cancel()
                            break

                return results

            all_results = await loop.run_in_executor(None, _process_all)

            # 更新数据库（回到 async 上下文）
            results = all_results

            # 持久化人员 embedding 缓存
            for person in persons:
                db.add(person)
            await db.commit()

            # 检查是否被取消
            if processing_tasks.get(task_id, {}).get("cancel"):
                task.status = "cancelled"
                await db.commit()
                return

            task.processed_count = len(results)
            task.success_count = sum(1 for r in results if r.get("status") == "success")
            task.no_target_count = sum(1 for r in results if r.get("status") == "no_target")
            task.failed_count = sum(1 for r in results if r.get("status") == "failed")
            task.results = results

            # 完成处理
            task.status = "completed"
            task.completed_at = datetime.utcnow()

            # 保存处理报告
            report = {
                "task_id": task.id,
                "task_name": task.name,
                "created_at": task.created_at.isoformat(),
                "completed_at": task.completed_at.isoformat(),
                "total_count": task.total_count,
                "success_count": task.success_count,
                "failed_count": task.failed_count,
                "no_target_count": task.no_target_count,
                "results": results
            }
            report_path = os.path.join(task.output_dir, "report.json")
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)

            await db.commit()
            logger.info(f"Task {task_id} completed successfully")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        try:
            async with async_session() as db:
                result = await db.execute(select(Task).where(Task.id == task_id))
                task = result.scalar_one_or_none()
                if task:
                    task.status = "failed"
                    task.error_message = str(e)
                    await db.commit()
        except Exception:
            pass
    finally:
        if task_id in processing_tasks:
            del processing_tasks[task_id]
