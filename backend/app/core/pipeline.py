"""
完整处理流水线
整合人脸检测、识别、分割和磨皮
"""
import cv2
import numpy as np
from typing import List, Dict, Optional
import os
import time
from datetime import datetime

from app.core.detector import FaceDetector
from app.core.recognizer import FaceRecognizer
from app.core.segmentor import SkinSegmentor
from app.core.beautifier import SkinBeautifier


class BeautyPipeline:
    """美颜处理流水线"""

    def __init__(
        self,
        persons: List,  # Person对象列表
        strength: int = 50,
        edge_protection: int = 70,
        detail_preserve: int = 60
    ):
        """
        初始化处理流水线

        Args:
            persons: 目标人员列表
            strength: 磨皮强度 0-100
            edge_protection: 边缘保护 0-100
            detail_preserve: 细节保留 0-100
        """
        self.persons = persons
        self.strength = strength
        self.edge_protection = edge_protection
        self.detail_preserve = detail_preserve

        # 初始化各模块
        self.detector = FaceDetector(min_detection_confidence=0.5)
        self.recognizer = FaceRecognizer(threshold=0.4)
        self.segmentor = SkinSegmentor()
        self.beautifier = SkinBeautifier(
            strength=strength,
            edge_protection=edge_protection,
            detail_preserve=detail_preserve
        )

        # 预加载目标人员的embeddings
        self.target_embeddings = self._load_target_embeddings()

    def _load_target_embeddings(self) -> List[Dict]:
        """加载目标人员的embeddings"""
        target_embeddings = []

        for person in self.persons:
            print(f"Processing person: {person.name} (id={person.id})")
            print(f"  reference_photos: {person.reference_photos}")
            if not person.reference_photos:
                print(f"  No reference photos, skipping")
                continue

            embeddings = []
            for photo_path in person.reference_photos:
                print(f"  Loading photo: {photo_path}")
                if not os.path.exists(photo_path):
                    print(f"  Photo not found: {photo_path}")
                    continue

                # 读取照片
                img = cv2.imread(photo_path)
                if img is None:
                    print(f"  Cannot read photo: {photo_path}")
                    continue

                # 提取embedding
                emb = self.recognizer.extract_embedding(img)
                if emb is not None:
                    embeddings.append(emb)
                    print(f"  OK: extracted embedding")
                else:
                    print(f"  Failed to extract embedding")

            if embeddings:
                target_embeddings.append({
                    "person_id": person.id,
                    "person_name": person.name,
                    "embeddings": embeddings
                })
                print(f"Loaded {len(embeddings)} embeddings for person {person.name} (id={person.id})")
            else:
                print(f"No valid embeddings for person {person.name}")

        print(f"Total target embeddings: {len(target_embeddings)}")
        return target_embeddings

    def process_image(self, image_path: str, output_dir: str) -> Dict:
        """
        处理单张图片

        Args:
            image_path: 输入图片路径
            output_dir: 输出目录

        Returns:
            处理结果字典
        """
        start_time = time.time()

        # 获取文件信息
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
            # 读取图像
            image = cv2.imread(image_path)
            if image is None:
                result["status"] = "failed"
                result["error_message"] = "无法读取图片"
                return result

            h, w = image.shape[:2]

            # 步骤1：检测所有人脸
            faces = self.detector.detect_and_crop(image)
            result["faces_detected"] = len(faces)

            if len(faces) == 0:
                # 未检测到人脸，直接复制原图
                result["status"] = "no_target"
                result["error_message"] = "未检测到人脸"
                self._copy_to_output(image_path, output_dir, filename, result)
                return result

            # 步骤2：识别目标人员
            target_faces = []
            print(f"Matching against {len(self.target_embeddings)} targets, threshold={self.recognizer.threshold}")
            for face in faces:
                # 提取embedding
                emb = self.recognizer.extract_embedding(image, face['bbox'])
                if emb is None:
                    continue

                # 匹配目标人员
                person_id, distance = self.recognizer.match_person(emb, self.target_embeddings)
                print(f"  Face bbox={face['bbox']}, distance={distance:.4f}, matched={person_id}")
                if person_id is not None:
                    face["matched_person_id"] = person_id
                    face["match_distance"] = distance
                    target_faces.append(face)

            result["targets_matched"] = len(target_faces)

            # 记录最小匹配距离和人脸位置
            if target_faces:
                min_distance = min(f.get("match_distance", float('inf')) for f in target_faces)
                result["match_distance"] = round(float(min_distance), 4)
                result["face_bboxes"] = [f['bbox'] for f in target_faces]

            if len(target_faces) == 0:
                # 未匹配到目标人员
                result["status"] = "no_target"
                result["error_message"] = "未匹配到目标人员"
                self._copy_to_output(image_path, output_dir, filename, result)
                return result

            # 步骤3：对每个目标人脸进行磨皮处理
            output_image = image.copy()
            for face in target_faces:
                # 获取皮肤mask
                skin_mask = self.segmentor.get_face_skin_mask(
                    image,
                    face['bbox'],
                    face.get('keypoints'),
                    exclude_eyes=True,
                    exclude_mouth=True
                )

                # 应用磨皮
                output_image = self.beautifier.beautify_with_detail(output_image, skin_mask)

            # 步骤4：保存结果
            output_filename = f"beautified_{filename}"
            output_path = os.path.join(output_dir, output_filename)
            cv2.imwrite(output_path, output_image)

            result["status"] = "success"
            result["output_path"] = output_path

            # 生成缩略图
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
        """复制原图到输出目录"""
        import shutil
        output_path = os.path.join(output_dir, f"original_{filename}")
        shutil.copy2(src_path, output_path)
        result["output_path"] = output_path

    def _generate_thumbnail(self, image: np.ndarray, output_dir: str, file_id: str) -> str:
        """生成缩略图"""
        thumb_dir = os.path.join(output_dir, "thumbnails")
        os.makedirs(thumb_dir, exist_ok=True)

        # 缩放
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

    def process_batch(self, image_paths: List[str], output_dir: str) -> List[Dict]:
        """
        批量处理图片

        Args:
            image_paths: 图片路径列表
            output_dir: 输出目录

        Returns:
            处理结果列表
        """
        results = []
        for i, image_path in enumerate(image_paths):
            print(f"处理进度: {i + 1}/{len(image_paths)} - {os.path.basename(image_path)}")
            result = self.process_image(image_path, output_dir)
            results.append(result)

        return results

    def __del__(self):
        """清理资源"""
        if hasattr(self, 'detector'):
            del self.detector
        if hasattr(self, 'recognizer'):
            del self.recognizer
        if hasattr(self, 'segmentor'):
            del self.segmentor


def test_pipeline():
    """测试处理流水线"""
    # 这里需要一个实际的Person对象，仅作演示
    print("Pipeline测试需要通过API接口调用")


if __name__ == "__main__":
    test_pipeline()
