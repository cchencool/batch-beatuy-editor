"""
人脸识别模块
使用InsightFace (ArcFace)
"""
import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
import os
import pickle


class FaceRecognizer:
    """人脸识别器"""

    def __init__(self, model_name: str = "buffalo_l", threshold: float = 0.4):
        """
        初始化人脸识别器

        Args:
            model_name: 模型名称
            threshold: 识别阈值（余弦距离，越小越相似）
        """
        self.threshold = threshold
        self.model_name = model_name
        self.app = None
        self._init_model()

    def _init_model(self):
        """初始化InsightFace模型"""
        try:
            import insightface
            from insightface.app import FaceAnalysis

            # 初始化FaceAnalysis
            self.app = FaceAnalysis(
                name=self.model_name,
                providers=['CPUExecutionProvider']  # 使用CPU，如有GPU可改为CUDAExecutionProvider
            )
            self.app.prepare(ctx_id=0, det_size=(640, 640))
        except Exception as e:
            print(f"InsightFace初始化失败: {e}")
            print("将使用备用方案：face_recognition库")
            self.app = None

    def extract_embedding(self, image: np.ndarray, face_bbox: Optional[List[int]] = None) -> Optional[np.ndarray]:
        """
        提取人脸embedding

        Args:
            image: BGR格式的图像
            face_bbox: 人脸边界框 [x, y, width, height]，如果为None则自动检测

        Returns:
            512维embedding向量，失败返回None
        """
        if self.app is None:
            return self._extract_embedding_fallback(image, face_bbox)

        # 如果提供了bbox，先裁剪
        if face_bbox is not None:
            x, y, w, h = face_bbox
            # 扩展裁剪区域
            pad = 0.3
            x1 = max(0, int(x - w * pad))
            y1 = max(0, int(y - h * pad))
            x2 = min(image.shape[1], int(x + w * (1 + pad)))
            y2 = min(image.shape[0], int(y + h * (1 + pad)))
            face_img = image[y1:y2, x1:x2]
        else:
            face_img = image

        # 检测并提取embedding
        faces = self.app.get(face_img)
        if len(faces) == 0:
            return None

        # 返回最大人脸的embedding
        largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        return largest_face.embedding

    def _extract_embedding_fallback(self, image: np.ndarray, face_bbox: Optional[List[int]] = None) -> Optional[np.ndarray]:
        """备用embedding提取方案（使用face_recognition库）"""
        try:
            import face_recognition

            # 转换到RGB
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # 如果提供了bbox，先裁剪
            if face_bbox is not None:
                x, y, w, h = face_bbox
                pad = 0.3
                x1 = max(0, int(x - w * pad))
                y1 = max(0, int(y - h * pad))
                x2 = min(rgb_image.shape[1], int(x + w * (1 + pad)))
                y2 = min(rgb_image.shape[0], int(y + h * (1 + pad)))
                face_img = rgb_image[y1:y2, x1:x2]
            else:
                face_img = rgb_image

            # 提取embedding
            encodings = face_recognition.face_encodings(face_img)
            if len(encodings) == 0:
                return None

            return encodings[0]

        except ImportError:
            print("face_recognition库未安装")
            return None
        except Exception as e:
            print(f"embedding提取失败: {e}")
            return None

    def compare_embeddings(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        比较两个embedding的相似度

        Args:
            emb1: 第一个embedding
            emb2: 第二个embedding

        Returns:
            余弦距离（0-2，越小越相似）
        """
        # 归一化
        emb1 = emb1 / np.linalg.norm(emb1)
        emb2 = emb2 / np.linalg.norm(emb2)

        # 计算余弦相似度
        cosine_sim = np.dot(emb1, emb2)

        # 转换为距离 (0-2)
        distance = 1 - cosine_sim

        return distance

    def match_person(
        self,
        face_embedding: np.ndarray,
        target_embeddings: List[Dict],
        threshold: Optional[float] = None
    ) -> Tuple[Optional[int], float]:
        """
        匹配目标人员

        Args:
            face_embedding: 待匹配的人脸embedding
            target_embeddings: 目标人员的embedding列表
                每个元素: {"person_id": int, "embeddings": List[np.ndarray]}
            threshold: 识别阈值，如为None则使用默认值

        Returns:
            (匹配的人员ID, 最小距离)，未匹配返回(None, float('inf'))
        """
        if threshold is None:
            threshold = self.threshold

        min_distance = float('inf')
        matched_person_id = None

        for target in target_embeddings:
            person_id = target["person_id"]
            embeddings = target["embeddings"]

            # 与该人员的所有参考照片比较
            for emb in embeddings:
                distance = self.compare_embeddings(face_embedding, emb)
                if distance < min_distance:
                    min_distance = distance
                    if distance < threshold:
                        matched_person_id = person_id

        return matched_person_id, min_distance

    def save_embeddings(self, embeddings: Dict[int, List[np.ndarray]], filepath: str):
        """
        保存embeddings到文件

        Args:
            embeddings: {person_id: [embedding1, embedding2, ...]}
            filepath: 保存路径
        """
        with open(filepath, 'wb') as f:
            pickle.dump(embeddings, f)

    def load_embeddings(self, filepath: str) -> Dict[int, List[np.ndarray]]:
        """
        从文件加载embeddings

        Args:
            filepath: 文件路径

        Returns:
            {person_id: [embedding1, embedding2, ...]}
        """
        if not os.path.exists(filepath):
            return {}

        with open(filepath, 'rb') as f:
            return pickle.load(f)


def test_recognizer():
    """测试人脸识别器"""
    recognizer = FaceRecognizer()

    # 创建测试图像
    test_image = np.zeros((200, 200, 3), dtype=np.uint8)

    # 提取embedding（会返回None因为没有真实人脸）
    emb = recognizer.extract_embedding(test_image)
    print(f"Embedding: {emb}")

    return recognizer


if __name__ == "__main__":
    test_recognizer()
