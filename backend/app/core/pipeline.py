"""
完整处理流水线
整合人脸检测、识别、分割和磨皮
"""
import cv2
import numpy as np
from typing import List, Dict, Optional
import os
import time
import threading
from datetime import datetime
from PIL import Image

from app.core.detector import FaceDetector
from app.core.recognizer import FaceRecognizer
from app.core.segmentor import SkinSegmentor
from app.core.beautifier import SkinBeautifier

# 优化参数
MAX_DIMENSION = 2000  # 处理时不超过此尺寸（降采样）
FACE_ROI_PAD = 0.5   # 人脸 ROI 扩边比例


def cv_imread_with_orientation(path: str) -> Optional[np.ndarray]:
    """读取图片并应用 EXIF 方向信息"""
    try:
        pil_img = Image.open(path)
        from PIL import ImageOps
        pil_img = ImageOps.exif_transpose(pil_img)
        rgb = np.array(pil_img)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        return cv2.imread(path)


def _calc_scale(w: int, h: int) -> float:
    """计算降采样比例，使最大边不超过 MAX_DIMENSION"""
    if max(w, h) <= MAX_DIMENSION:
        return 1.0
    return MAX_DIMENSION / max(w, h)


class BeautyPipeline:
    """美颜处理流水线"""

    def __init__(
        self,
        persons: List,
        strength: int = 50,
        edge_protection: int = 70,
        detail_preserve: int = 60
    ):
        self.persons = persons
        self.strength = strength
        self.edge_protection = edge_protection
        self.detail_preserve = detail_preserve

        self.detector = FaceDetector(min_detection_confidence=0.5)
        self.recognizer = FaceRecognizer(threshold=0.4)
        self.segmentor = SkinSegmentor()
        self.beautifier = SkinBeautifier(
            strength=strength,
            edge_protection=edge_protection,
            detail_preserve=detail_preserve
        )

        self.target_embeddings = self._load_target_embeddings()

        # 线程安全：InsightFace 不是线程安全的，使用锁保护
        self._recognizer_lock = threading.Lock()

    def _load_target_embeddings(self) -> List[Dict]:
        """加载目标人员的embeddings（优先使用缓存）"""
        import json
        import hashlib

        target_embeddings = []

        for person in self.persons:
            if not person.reference_photos:
                continue

            # 计算参考照片的版本哈希
            photo_list = sorted(person.reference_photos) if person.reference_photos else []
            version_key = hashlib.md5("|".join(photo_list).encode()).hexdigest()

            cached = person.face_embeddings or {}
            cached_version = cached.get("version", "") if isinstance(cached, dict) else ""
            cached_data = cached.get("data", []) if isinstance(cached, dict) else []

            # 如果缓存有效且版本匹配，直接使用
            if cached_version == version_key and cached_data:
                embeddings = [np.array(e, dtype=np.float32) for e in cached_data]
                target_embeddings.append({
                    "person_id": person.id,
                    "person_name": person.name,
                    "embeddings": embeddings
                })
                continue

            # 没有有效缓存，重新提取
            embeddings = []
            for photo_path in person.reference_photos:
                if not os.path.exists(photo_path):
                    continue

                img = cv_imread_with_orientation(photo_path)
                if img is None:
                    continue

                emb = self.recognizer.extract_embedding(img)
                if emb is not None:
                    embeddings.append(emb)

            if embeddings:
                target_embeddings.append({
                    "person_id": person.id,
                    "person_name": person.name,
                    "embeddings": embeddings
                })

                # 持久化缓存到数据库对象（由调用方 commit）
                serialized = [e.tolist() for e in embeddings]
                person.face_embeddings = {
                    "version": version_key,
                    "data": serialized
                }

        return target_embeddings

    def _get_face_roi(self, img: np.ndarray, bbox: List[int]) -> tuple:
        """根据 bbox 计算人脸 ROI (x1, y1, x2, y2)，带扩边"""
        h, w = img.shape[:2]
        x, y, bw, bh = bbox
        pad_x = int(bw * FACE_ROI_PAD)
        pad_y = int(bh * FACE_ROI_PAD)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w, x + bw + pad_x)
        y2 = min(h, y + bh + pad_y)
        return x1, y1, x2, y2

    def process_image(self, image_path: str, output_dir: str) -> Dict:
        """
        处理单张图片
        1. 降采样大图 → 检测/识别速度快
        2. 人脸 ROI 裁剪 → 磨皮只处理局部，快 5-20×
        3. 结果上采样回原图
        """
        start_time = time.time()

        filename = os.path.basename(image_path)
        file_id = os.path.splitext(filename)[0]

        result = {
            "file_id": file_id,
            "filename": filename,
            "status": "pending",
            "faces_detected": 0,
            "targets_matched": 0,
            "output_path": None,
            "thumbnail_path": None,
            "process_time_ms": 0,
            "error_message": None
        }

        try:
            # 读取原图
            image = cv_imread_with_orientation(image_path)
            if image is None:
                result["status"] = "failed"
                result["error_message"] = "无法读取图片"
                return result

            orig_h, orig_w = image.shape[:2]
            scale = _calc_scale(orig_w, orig_h)

            # 降采样
            if scale < 1.0:
                small_img = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            else:
                small_img = image

            # 步骤1：在降采样图上检测人脸
            faces = self.detector.detect_and_crop(small_img)
            result["faces_detected"] = len(faces)

            if len(faces) == 0:
                result["status"] = "no_target"
                result["error_message"] = "未检测到人脸"
                self._copy_to_output(image_path, output_dir, filename, result)
                return result

            # 步骤2：识别目标人员（在降采样图上）
            target_faces = []
            for face in faces:
                with self._recognizer_lock:
                    emb = self.recognizer.extract_embedding(small_img, face['bbox'])
                if emb is None:
                    continue

                person_id, distance = self.recognizer.match_person(emb, self.target_embeddings)
                if person_id is not None:
                    bbox_scaled = [
                        int(face['bbox'][0] / scale),
                        int(face['bbox'][1] / scale),
                        int(face['bbox'][2] / scale),
                        int(face['bbox'][3] / scale),
                    ]
                    face["matched_person_id"] = person_id
                    face["match_distance"] = distance
                    face["bbox"] = bbox_scaled  # 回原图坐标
                    target_faces.append(face)

            result["targets_matched"] = len(target_faces)

            if target_faces:
                min_distance = min(f.get("match_distance", float('inf')) for f in target_faces)
                result["match_distance"] = round(float(min_distance), 4)
                result["face_bboxes"] = [f['bbox'] for f in target_faces]

            if len(target_faces) == 0:
                result["status"] = "no_target"
                result["error_message"] = "未匹配到目标人员"
                self._copy_to_output(image_path, output_dir, filename, result)
                return result

            # 步骤3：在每张人脸的 ROI 上做磨皮（避免全图处理）
            output_image = image.copy()
            for face in target_faces:
                bbox = face['bbox']
                x1, y1, x2, y2 = self._get_face_roi(image, bbox)

                # 裁剪人脸区域
                face_roi = image[y1:y2, x1:x2]

                # 在人脸 ROI 上生成皮肤 mask
                roi_bbox = [bbox[0] - x1, bbox[1] - y1, bbox[2], bbox[3]]
                roi_keypoints = {}
                if face.get('keypoints'):
                    for k, (kx, ky) in face['keypoints'].items():
                        roi_keypoints[k] = (int(kx / scale) - x1, int(ky / scale) - y1)

                skin_mask = self.segmentor.get_face_skin_mask(
                    face_roi,
                    roi_bbox,
                    roi_keypoints if roi_keypoints else None,
                    exclude_eyes=True,
                    exclude_mouth=True
                )

                # 在 ROI 上磨皮
                beautified_roi = self.beautifier.beautify_with_detail(face_roi, skin_mask)

                # 贴回原图
                output_image[y1:y2, x1:x2] = beautified_roi

            # 步骤4：保存结果
            output_filename = f"beautified_{filename}"
            output_path = os.path.join(output_dir, output_filename)
            cv2.imwrite(output_path, output_image)

            result["status"] = "success"
            result["output_path"] = output_path

            # 缩略图
            thumb_path = self._generate_thumbnail(output_image, output_dir, file_id)
            result["thumbnail_path"] = thumb_path

        except Exception as e:
            result["status"] = "failed"
            result["error_message"] = str(e)

        finally:
            elapsed = (time.time() - start_time) * 1000
            result["process_time_ms"] = int(elapsed)

        return result

    def _copy_to_output(self, src_path: str, output_dir: str, filename: str, result: Dict):
        import shutil
        output_path = os.path.join(output_dir, f"original_{filename}")
        shutil.copy2(src_path, output_path)
        result["output_path"] = output_path

    def _generate_thumbnail(self, image: np.ndarray, output_dir: str, file_id: str) -> str:
        thumb_dir = os.path.join(output_dir, "thumbnails")
        os.makedirs(thumb_dir, exist_ok=True)

        thumb = image.copy()
        max_size = 200
        h, w = thumb.shape[:2]
        if h > w:
            new_h = max_size
            new_w = int(w * max_size / h)
        else:
            new_w = max_size
            new_h = int(h * max_size / w)

        thumb = cv2.resize(thumb, (new_w, new_h))
        thumb_path = os.path.join(thumb_dir, f"{file_id}_thumb.jpg")
        cv2.imwrite(thumb_path, thumb)
        return thumb_path

    def __del__(self):
        if hasattr(self, 'detector'):
            del self.detector
        if hasattr(self, 'recognizer'):
            del self.recognizer
        if hasattr(self, 'segmentor'):
            del self.segmentor
