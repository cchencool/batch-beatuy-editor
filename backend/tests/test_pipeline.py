"""BeautyPipeline 冒烟测试：缓存加载与无脸图处理（不依赖真实人脸照片）"""
import hashlib

import cv2
import numpy as np

from app.core.pipeline import BeautyPipeline


def test_load_target_embeddings_uses_cache():
    """缓存版本命中时直接加载，不触发模型提取"""
    photos = ["/nonexistent/a.jpg", "/nonexistent/b.jpg"]
    version = hashlib.md5("|".join(sorted(photos)).encode()).hexdigest()
    cached_vec = np.ones(512, dtype=np.float32).tolist()

    persons = [{
        "id": 1,
        "name": "测试",
        "reference_photos": photos,
        "face_embeddings": {"version": version, "data": [cached_vec]},
    }]

    pipeline = BeautyPipeline(persons=persons)
    assert len(pipeline.target_embeddings) == 1
    assert pipeline.target_embeddings[0]["person_id"] == 1
    assert pipeline.updated_embeddings == {}  # 缓存命中无需回写


def test_load_target_embeddings_invalid_cache_skips_missing_files():
    """缓存失效且照片不存在时，该人员被跳过"""
    persons = [{
        "id": 1,
        "name": "测试",
        "reference_photos": ["/nonexistent/a.jpg"],
        "face_embeddings": {},
    }]
    pipeline = BeautyPipeline(persons=persons)
    assert pipeline.target_embeddings == []
    assert pipeline.updated_embeddings == {}


def test_process_blank_image_returns_no_target(tmp_path):
    """纯色图无脸：无论模型是否可用，都应优雅返回 no_target 并复制原图"""
    img_path = tmp_path / "blank.jpg"
    cv2.imwrite(str(img_path), np.full((100, 100, 3), 128, dtype=np.uint8))
    output_dir = tmp_path / "out"
    output_dir.mkdir()

    pipeline = BeautyPipeline(persons=[])
    result = pipeline.process_image(str(img_path), str(output_dir))

    assert result["status"] == "no_target"
    assert result["faces_detected"] == 0
    assert result["image_width"] == 100
    assert result["image_height"] == 100
    assert result["output_path"] is not None
    assert result["process_time_ms"] >= 0


def test_process_missing_file_returns_failed(tmp_path):
    """文件不存在时返回 failed，不抛异常"""
    pipeline = BeautyPipeline(persons=[])
    result = pipeline.process_image(str(tmp_path / "nope.jpg"), str(tmp_path))
    assert result["status"] == "failed"
    assert result["error_message"]
