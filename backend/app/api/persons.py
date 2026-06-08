"""
人员管理API
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime
import os
import uuid
import shutil

from app.models.database import Person, get_db
from app.models.schemas import (
    PersonCreate, PersonUpdate, PersonResponse,
    PersonListResponse, MessageResponse
)
from app.core.config import settings

router = APIRouter()


def _path_to_url(path: str) -> str:
    """将绝对路径转换为静态文件URL（相对于PERSONS_DIR）"""
    if not path:
        return ""
    # 提取相对于PERSONS_DIR的路径
    if path.startswith(settings.PERSONS_DIR):
        relative = os.path.relpath(path, settings.PERSONS_DIR)
        return f"/static/persons/{relative}"
    # 如果不在PERSONS_DIR下，尝试其他已知目录
    for name, base_dir in [("uploads", settings.UPLOADS_DIR), ("outputs", settings.OUTPUTS_DIR)]:
        if path.startswith(base_dir):
            relative = os.path.relpath(path, base_dir)
            return f"/static/{name}/{relative}"
    # 最后只取文件名
    return f"/static/persons/{os.path.basename(path)}"


def _person_to_response(p: Person) -> PersonResponse:
    """将数据库模型转换为响应对象"""
    return PersonResponse(
        id=p.id,
        name=p.name,
        note=p.note,
        avatar_path=p.avatar_path,
        avatar_url=_path_to_url(p.avatar_path) if p.avatar_path else None,
        reference_photos=p.reference_photos or [],
        photo_urls=[_path_to_url(ph) for ph in (p.reference_photos or [])],
        is_active=p.is_active,
        process_count=p.process_count,
        last_process_time=p.last_process_time,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.get("/", response_model=PersonListResponse)
async def list_persons(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取人员列表"""
    query = select(Person).where(Person.is_active == True)

    if search:
        query = query.where(Person.name.contains(search))

    query = query.order_by(Person.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    persons = result.scalars().all()

    # 获取总数
    count_query = select(func.count()).select_from(Person).where(Person.is_active == True)
    if search:
        count_query = count_query.where(Person.name.contains(search))
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # 为每个人员计算URL字段
    person_responses = [_person_to_response(p) for p in persons]
    return PersonListResponse(persons=person_responses, total=total)


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(person_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个人员详情"""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")

    return _person_to_response(person)


@router.post("/", response_model=PersonResponse)
async def create_person(
    name: str = Form(...),
    note: Optional[str] = Form(None),
    photos: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    """创建新人员（上传参考照片）"""
    # 验证照片数量
    if not photos or len(photos) == 0:
        raise HTTPException(status_code=400, detail="至少需要上传一张参考照片")

    # 创建人员目录
    person_dir = os.path.join(settings.PERSONS_DIR, f"person_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}")
    os.makedirs(person_dir, exist_ok=True)

    # 保存参考照片
    photo_paths = []
    for photo in photos:
        if not photo.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            continue

        ext = os.path.splitext(photo.filename)[1].lower()
        photo_filename = f"{uuid.uuid4().hex}{ext}"
        photo_path = os.path.join(person_dir, photo_filename)

        with open(photo_path, "wb") as f:
            content = await photo.read()
            f.write(content)

        photo_paths.append(photo_path)

    if not photo_paths:
        shutil.rmtree(person_dir)
        raise HTTPException(status_code=400, detail="没有有效的图片文件")

    # 创建人员记录
    person = Person(
        name=name,
        note=note,
        avatar_path=photo_paths[0],  # 第一张作为头像
        reference_photos=photo_paths,
        face_embeddings=[]  # 后续提取embedding
    )

    db.add(person)
    await db.commit()
    await db.refresh(person)

    return _person_to_response(person)


@router.put("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: int,
    person_update: PersonUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新人员信息"""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")

    if person_update.name is not None:
        person.name = person_update.name
    if person_update.note is not None:
        person.note = person_update.note

    person.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(person)

    return _person_to_response(person)


@router.delete("/{person_id}", response_model=MessageResponse)
async def delete_person(person_id: int, db: AsyncSession = Depends(get_db)):
    """删除人员（软删除）"""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")

    person.is_active = False
    person.updated_at = datetime.utcnow()
    await db.commit()

    return MessageResponse(success=True, message=f"人员 {person.name} 已删除")


@router.post("/{person_id}/photos", response_model=PersonResponse)
async def add_photos(
    person_id: int,
    photos: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    """添加参考照片"""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")

    # 获取人员目录
    if person.reference_photos:
        person_dir = os.path.dirname(person.reference_photos[0])
    else:
        person_dir = os.path.join(settings.PERSONS_DIR, f"person_{person.id}")
        os.makedirs(person_dir, exist_ok=True)

    # 保存新照片
    new_paths = list(person.reference_photos) if person.reference_photos else []
    for photo in photos:
        if not photo.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            continue

        ext = os.path.splitext(photo.filename)[1].lower()
        photo_filename = f"{uuid.uuid4().hex}{ext}"
        photo_path = os.path.join(person_dir, photo_filename)

        with open(photo_path, "wb") as f:
            content = await photo.read()
            f.write(content)

        new_paths.append(photo_path)

    person.reference_photos = new_paths
    person.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(person)

    return _person_to_response(person)


@router.delete("/{person_id}/photos/{photo_index}", response_model=PersonResponse)
async def delete_photo(
    person_id: int,
    photo_index: int,
    db: AsyncSession = Depends(get_db)
):
    """删除参考照片"""
    result = await db.execute(select(Person).where(Person.id == person_id))
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="人员不存在")

    photos = person.reference_photos or []
    if photo_index < 0 or photo_index >= len(photos):
        raise HTTPException(status_code=400, detail="照片索引无效")

    # 删除照片文件
    photo_path = photos[photo_index]
    if os.path.exists(photo_path):
        os.remove(photo_path)

    # 更新列表
    photos.pop(photo_index)
    person.reference_photos = photos

    # 如果删除的是头像，更新头像
    if person.avatar_path == photo_path and photos:
        person.avatar_path = photos[0]
    elif not photos:
        person.avatar_path = None

    person.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(person)

    return _person_to_response(person)