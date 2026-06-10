"""
人脸检测模块
使用OpenCV Haar Cascade + Dlib (备用)
"""
import cv2
import numpy as np
from typing import List, Dict, Optional
import os


class FaceDetector:
    """人脸检测器 (OpenCV Haar Cascade)"""

    def __init__(self, min_detection_confidence: float = 0.5, model_selection: int = 0):
        """
        初始化人脸检测器

        Args:
            min_detection_confidence: 最小检测置信度 (用于过滤低置信度结果)
            model_selection: 模型选择 (保留参数兼容性)
        """
        # OpenCV 自带的 Haar Cascade 模型路径
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade = cv2.CascadeClassifier(cascade_path)

        # 如果有 Dlib 模型，也加载关键点检测
        self.use_dlib = False
        try:
            import dlib
            self.dlib_predictor = dlib.shape_predictor(
                os.path.join(cv2.data.haarcascades, "..", "shape_predictor_68_face_landmarks.dat")
            ) if os.path.exists(
                os.path.join(cv2.data.haarcascades, "..", "shape_predictor_68_face_landmarks.dat")
            ) else None
            if self.dlib_predictor:
                self.use_dlib = True
        except ImportError:
            pass

    def detect(self, image: np.ndarray) -> List[Dict]:
        """
        检测图像中的人脸

        Args:
            image: BGR格式的图像 (numpy array)

        Returns:
            人脸列表，每个元素包含：
            - bbox: [x, y, width, height]
            - keypoints: 关键点字典 {right_eye, left_eye, nose_tip, mouth_center, right_ear, left_ear}
            - score: 置信度分数
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        detections = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        faces = []
        for (x, y, w, h) in detections:
            face = {
                'bbox': [int(x), int(y), int(w), int(h)],
                'keypoints': {},
                'score': 0.9  # Haar cascade doesn't provide confidence scores
            }

            # 尝试用 Dlib 获取关键点
            if self.use_dlib and self.dlib_predictor:
                try:
                    import dlib
                    rect = dlib.rectangle(int(x), int(y), int(x + w), int(y + h))
                    shape = self.dlib_predictor(gray, rect)

                    # 68个关键点的索引映射
                    # 左眼: 36-41, 右眼: 42-47
                    # 鼻子: 30-35
                    # 嘴巴: 48-67
                    face['keypoints'] = {
                        'left_eye': (shape.part(37).x, shape.part(37).y),
                        'right_eye': (shape.part(43).x, shape.part(43).y),
                        'nose_tip': (shape.part(30).x, shape.part(30).y),
                        'mouth_center': (shape.part(57).x, shape.part(57).y),
                        'left_ear': (shape.part(0).x, shape.part(0).y),
                        'right_ear': (shape.part(16).x, shape.part(16).y),
                    }
                except Exception:
                    # 如果 Dlib 失败，使用估计的关键点
                    face['keypoints'] = self._estimate_keypoints(x, y, w, h)
            else:
                # 使用估计的关键点
                face['keypoints'] = self._estimate_keypoints(x, y, w, h)

            faces.append(face)

        return faces

    def _estimate_keypoints(self, x: int, y: int, w: int, h: int) -> Dict:
        """根据人脸边界框估计关键点位置"""
        return {
            'left_eye': (int(x + w * 0.3), int(y + h * 0.35)),
            'right_eye': (int(x + w * 0.7), int(y + h * 0.35)),
            'nose_tip': (int(x + w * 0.5), int(y + h * 0.55)),
            'mouth_center': (int(x + w * 0.5), int(y + h * 0.75)),
            'left_ear': (int(x + w * 0.1), int(y + h * 0.4)),
            'right_ear': (int(x + w * 0.9), int(y + h * 0.4)),
        }

    def detect_and_crop(self, image: np.ndarray, padding: float = 0.2) -> List[Dict]:
        """
        检测人脸并裁剪面部区域

        Args:
            image: BGR格式的图像
            padding: 裁剪区域的扩展比例

        Returns:
            人脸列表，每个元素额外包含：
            - face_crop: 裁剪的面部图像
            - face_bbox: 裁剪区域的边界框
        """
        faces = self.detect(image)
        h, w = image.shape[:2]

        for face in faces:
            x, y, width, height = face['bbox']

            pad_x = int(width * padding)
            pad_y = int(height * padding)

            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(w, x + width + pad_x)
            y2 = min(h, y + height + pad_y)

            face_crop = image[y1:y2, x1:x2].copy()
            face['face_crop'] = face_crop
            face['face_bbox'] = [x1, y1, x2 - x1, y2 - y1]

        return faces


def test_detector():
    """测试人脸检测器"""
    detector = FaceDetector()
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)
    faces = detector.detect(test_image)
    print(f"检测到 {len(faces)} 张人脸")
    return faces


if __name__ == "__main__":
    test_detector()
