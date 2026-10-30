"""
人脸识别模块
使用 InsightFace (ArcFace)，模型全局单例，检测与 embedding 一次完成
"""
import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
import os
import threading


# ============ 模型全局单例（避免每个任务重复加载数百MB模型） ============

_model_lock = threading.Lock()
_inference_lock = threading.Lock()  # InsightFace 非线程安全，推理需串行
_face_app = None
_model_error: Optional[str] = None
_MODEL_NAME = "buffalo_l"


def get_face_app():
    """获取全局 FaceAnalysis 实例（懒加载，线程安全）"""
    global _face_app, _model_error

    if _face_app is not None or _model_error is not None:
        return _face_app

    with _model_lock:
        if _face_app is not None or _model_error is not None:
            return _face_app

        model_dir = os.path.expanduser(f"~/.insightface/models/{_MODEL_NAME}")
        if not os.path.exists(model_dir):
            _model_error = f"InsightFace模型未下载: {model_dir}"
            print(_model_error)
            return None

        try:
            from insightface.app import FaceAnalysis

            app = FaceAnalysis(
                name=_MODEL_NAME,
                providers=['CPUExecutionProvider']
            )
            app.prepare(ctx_id=0, det_size=(640, 640))
            _face_app = app
            print(f"InsightFace模型初始化成功: {_MODEL_NAME}")
        except Exception as e:
            _model_error = f"InsightFace初始化失败: {e}"
            print(_model_error)

        return _face_app


def get_model_status() -> Dict:
    """获取模型状态（用于健康检查和前端警告）"""
    return {
        "available": _face_app is not None,
        "error": _model_error,
        "loaded": _face_app is not None,
    }


def warmup_model():
    """服务启动时预加载模型"""
    get_face_app()


class FaceRecognizer:
    """人脸识别器（轻量封装，模型为全局单例）"""

    def __init__(self, model_name: str = "buffalo_l", threshold: float = 0.4):
        """
        Args:
            model_name: 保留参数兼容性（实际模型由全局单例管理）
            threshold: 识别阈值（余弦距离，越小越相似）
        """
        self.threshold = threshold

    def detect_faces(self, image: np.ndarray) -> List[Dict]:
        """
        一次调用完成人脸检测 + embedding 提取 + 关键点

        Returns:
            人脸列表，每个元素包含：
            - bbox: [x, y, width, height]
            - embedding: 512维向量
            - keypoints: {left_eye, right_eye, nose_tip, mouth_center}
            - score: 检测置信度
        """
        app = get_face_app()
        if app is None:
            return []

        with _inference_lock:
            faces = app.get(image)

        results = []
        for face in faces:
            x1, y1, x2, y2 = face.bbox
            keypoints = {}
            if face.kps is not None and len(face.kps) >= 5:
                # InsightFace 5点顺序: 左眼、右眼、鼻尖、左嘴角、右嘴角
                kps = face.kps
                keypoints = {
                    'left_eye': (int(kps[0][0]), int(kps[0][1])),
                    'right_eye': (int(kps[1][0]), int(kps[1][1])),
                    'nose_tip': (int(kps[2][0]), int(kps[2][1])),
                    'mouth_center': (
                        int((kps[3][0] + kps[4][0]) / 2),
                        int((kps[3][1] + kps[4][1]) / 2),
                    ),
                }

            results.append({
                'bbox': [
                    int(max(0, x1)),
                    int(max(0, y1)),
                    int(max(0, x2 - x1)),
                    int(max(0, y2 - y1)),
                ],
                'embedding': face.embedding,
                'keypoints': keypoints,
                'score': float(face.det_score) if face.det_score is not None else 1.0,
            })

        return results

    def extract_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """提取图片中最大人脸的 embedding（用于参考照片）"""
        faces = self.detect_faces(image)
        if not faces:
            return None
        largest = max(faces, key=lambda f: f['bbox'][2] * f['bbox'][3])
        return largest['embedding']

    def compare_embeddings(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """比较两个embedding的余弦距离（0-2，越小越相似）"""
        emb1 = emb1 / np.linalg.norm(emb1)
        emb2 = emb2 / np.linalg.norm(emb2)
        return float(1 - np.dot(emb1, emb2))

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
            target_embeddings: [{"person_id": int, "embeddings": List[np.ndarray]}]
            threshold: 识别阈值，如为None则使用默认值

        Returns:
            (匹配的人员ID, 最小距离)，未匹配返回(None, float('inf'))
        """
        if threshold is None:
            threshold = self.threshold

        min_distance = float('inf')
        matched_person_id = None
        best_match_distance = float('inf')

        for target in target_embeddings:
            person_id = target["person_id"]
            for emb in target["embeddings"]:
                distance = self.compare_embeddings(face_embedding, emb)
                if distance < min_distance:
                    min_distance = distance
                # 记录阈值内的最优匹配（距离最小者优先）
                if distance < threshold and distance < best_match_distance:
                    best_match_distance = distance
                    matched_person_id = person_id

        return matched_person_id, min_distance
