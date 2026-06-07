"""
人脸检测模块
使用MediaPipe Face Detection
"""
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional
import mediapipe as mp


class FaceDetector:
    """人脸检测器"""

    def __init__(self, min_detection_confidence: float = 0.5, model_selection: int = 0):
        """
        初始化人脸检测器

        Args:
            min_detection_confidence: 最小检测置信度
            model_selection: 模型选择 (0: 近距离，1: 远距离)
        """
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            min_detection_confidence=min_detection_confidence,
            model_selection=model_selection
        )

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
        # 转换到RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image.shape[:2]

        # 检测人脸
        results = self.face_detection.process(image_rgb)

        faces = []
        if results.detections:
            for detection in results.detections:
                # 获取边界框
                bbox = detection.location_data.relative_bounding_box
                x = int(bbox.xmin * w)
                y = int(bbox.ymin * h)
                width = int(bbox.width * w)
                height = int(bbox.height * h)

                # 确保边界在图像范围内
                x = max(0, x)
                y = max(0, y)
                width = min(w - x, width)
                height = min(h - y, height)

                # 获取关键点
                keypoints = {}
                if detection.location_data.relative_keypoints:
                    kp_names = ['right_eye', 'left_eye', 'nose_tip', 'mouth_center', 'right_ear', 'left_ear']
                    for i, kp in enumerate(detection.location_data.relative_keypoints):
                        if i < len(kp_names):
                            keypoints[kp_names[i]] = (int(kp.x * w), int(kp.y * h))

                faces.append({
                    'bbox': [x, y, width, height],
                    'keypoints': keypoints,
                    'score': detection.score[0]
                })

        return faces

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

            # 计算扩展后的裁剪区域
            pad_x = int(width * padding)
            pad_y = int(height * padding)

            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(w, x + width + pad_x)
            y2 = min(h, y + height + pad_y)

            # 裁剪面部
            face_crop = image[y1:y2, x1:x2].copy()
            face['face_crop'] = face_crop
            face['face_bbox'] = [x1, y1, x2 - x1, y2 - y1]

        return faces

    def __del__(self):
        """清理资源"""
        if hasattr(self, 'face_detection'):
            self.face_detection.close()


def test_detector():
    """测试人脸检测器"""
    # 创建检测器
    detector = FaceDetector()

    # 创建测试图像（黑色背景）
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)

    # 检测人脸
    faces = detector.detect(test_image)
    print(f"检测到 {len(faces)} 张人脸")

    return faces


if __name__ == "__main__":
    test_detector()
