"""
皮肤分割模块
使用MediaPipe Selfie Segmentation + 人脸区域限制
"""
import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
import mediapipe as mp


class SkinSegmentor:
    """皮肤分割器"""

    def __init__(self, model_selection: int = 0):
        """
        初始化皮肤分割器

        Args:
            model_selection: 模型选择 (0: general, 1: landscape)
        """
        self.mp_selfie_segmentation = mp.solutions.selfie_segmentation
        self.segmentor = self.mp_selfie_segmentation.SelfieSegmentation(
            model_selection=model_selection
        )

        # MediaPipe FaceMesh用于精细分割
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

    def get_skin_mask(self, image: np.ndarray, face_bbox: Optional[List[int]] = None) -> np.ndarray:
        """
        获取皮肤区域mask

        Args:
            image: BGR格式的图像
            face_bbox: 人脸边界框 [x, y, width, height]，用于限制分割区域

        Returns:
            二值mask (0或255)，与输入图像尺寸相同
        """
        h, w = image.shape[:2]

        # 如果提供了bbox，裁剪处理
        if face_bbox is not None:
            x, y, width, height = face_bbox
            # 扩展区域
            pad = 0.3
            x1 = max(0, int(x - width * pad))
            y1 = max(0, int(y - height * pad))
            x2 = min(w, int(x + width * (1 + pad)))
            y2 = min(h, int(y + height * (1 + pad)))

            crop_img = image[y1:y2, x1:x2]
            crop_mask = self._segment_skin(crop_img)

            # 放回原图
            full_mask = np.zeros((h, w), dtype=np.uint8)
            full_mask[y1:y2, x1:x2] = crop_mask
        else:
            full_mask = self._segment_skin(image)

        return full_mask

    def _segment_skin(self, image: np.ndarray) -> np.ndarray:
        """内部方法：执行皮肤分割"""
        h, w = image.shape[:2]

        # 转换到RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # 使用selfie segmentation获取人像区域
        results = self.segmentor.process(image_rgb)

        if results.segmentation_mask is None:
            return np.zeros((h, w), dtype=np.uint8)

        # 获取人像mask
        person_mask = (results.segmentation_mask > 0.5).astype(np.uint8) * 255

        # 使用颜色信息进一步提取皮肤区域
        skin_mask = self._detect_skin_by_color(image)

        # 合并：人像mask 与 皮肤颜色mask 的交集
        combined_mask = cv2.bitwise_and(person_mask, skin_mask)

        return combined_mask

    def _detect_skin_by_color(self, image: np.ndarray) -> np.ndarray:
        """通过颜色检测皮肤区域"""
        # 转换到HSV和YCrCb颜色空间
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)

        # HSV空间的皮肤阈值
        lower_hsv = np.array([0, 20, 70], dtype=np.uint8)
        upper_hsv = np.array([20, 255, 255], dtype=np.uint8)
        mask_hsv = cv2.inRange(hsv, lower_hsv, upper_hsv)

        # YCrCb空间的皮肤阈值
        lower_ycrcb = np.array([0, 135, 85], dtype=np.uint8)
        upper_ycrcb = np.array([255, 180, 135], dtype=np.uint8)
        mask_ycrcb = cv2.inRange(ycrcb, lower_ycrcb, upper_ycrcb)

        # 合并两个颜色空间的检测结果
        skin_mask = cv2.bitwise_or(mask_hsv, mask_ycrcb)

        # 形态学操作去除噪点
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)

        return skin_mask

    def get_face_skin_mask(
        self,
        image: np.ndarray,
        face_bbox: List[int],
        keypoints: Optional[Dict] = None,
        exclude_eyes: bool = True,
        exclude_mouth: bool = True
    ) -> np.ndarray:
        """
        获取面部皮肤区域的精确mask（排除眼睛、嘴巴等）

        Args:
            image: BGR格式的图像
            face_bbox: 人脸边界框 [x, y, width, height]
            keypoints: 人脸关键点字典
            exclude_eyes: 是否排除眼睛区域
            exclude_mouth: 是否排除嘴巴区域

        Returns:
            二值mask，只包含皮肤区域
        """
        h, w = image.shape[:2]
        x, y, width, height = face_bbox

        # 获取基础皮肤mask
        skin_mask = self.get_skin_mask(image, face_bbox)

        # 使用FaceMesh获取精细面部特征
        if keypoints:
            # 创建排除区域的mask
            exclude_mask = np.zeros((h, w), dtype=np.uint8)

            # 排除眼睛区域
            if exclude_eyes and 'left_eye' in keypoints and 'right_eye' in keypoints:
                left_eye = keypoints['left_eye']
                right_eye = keypoints['right_eye']

                # 以关键点为中心创建圆形排除区域
                eye_radius = int(width * 0.08)
                cv2.circle(exclude_mask, left_eye, eye_radius, 255, -1)
                cv2.circle(exclude_mask, right_eye, eye_radius, 255, -1)

            # 排除嘴巴区域
            if exclude_mouth and 'mouth_center' in keypoints:
                mouth = keypoints['mouth_center']
                mouth_radius = int(width * 0.1)
                cv2.circle(exclude_mask, mouth, mouth_radius, 255, -1)

            # 排除鼻子区域（可选）
            if 'nose_tip' in keypoints:
                nose = keypoints['nose_tip']
                nose_radius = int(width * 0.06)
                cv2.circle(exclude_mask, nose, nose_radius, 255, -1)

            # 从皮肤mask中排除这些区域
            skin_mask = cv2.bitwise_and(skin_mask, cv2.bitwise_not(exclude_mask))

        # 限制在人脸边界框内
        face_region_mask = np.zeros((h, w), dtype=np.uint8)
        pad = 0.1
        x1 = max(0, int(x - width * pad))
        y1 = max(0, int(y - height * pad))
        x2 = min(w, int(x + width * (1 + pad)))
        y2 = min(h, int(y + height * (1 + pad)))
        face_region_mask[y1:y2, x1:x2] = 255

        skin_mask = cv2.bitwise_and(skin_mask, face_region_mask)

        # 边缘羽化
        skin_mask = cv2.GaussianBlur(skin_mask, (5, 5), 0)

        return skin_mask

    def refine_mask_with_facemesh(
        self,
        image: np.ndarray,
        face_bbox: List[int]
    ) -> np.ndarray:
        """
        使用MediaPipe FaceMesh进行精细分割

        Args:
            image: BGR格式的图像
            face_bbox: 人脸边界框

        Returns:
            精细的皮肤mask
        """
        h, w = image.shape[:2]

        # 裁剪人脸区域
        x, y, width, height = face_bbox
        pad = 0.3
        x1 = max(0, int(x - width * pad))
        y1 = max(0, int(y - height * pad))
        x2 = min(w, int(x + width * (1 + pad)))
        y2 = min(h, int(y + height * (1 + pad)))

        face_img = image[y1:y2, x1:x2]
        face_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)

        # 使用FaceMesh检测
        results = self.face_mesh.process(face_rgb)

        if not results.multi_face_landmarks:
            # 回退到基础方法
            return self.get_skin_mask(image, face_bbox)

        # 获取面部轮廓点
        face_landmarks = results.multi_face_landmarks[0]

        # FaceMesh的面部轮廓索引（卵圆形轮廓）
        face_oval_indices = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ]

        # 创建面部轮廓mask
        fh, fw = face_img.shape[:2]
        mask = np.zeros((fh, fw), dtype=np.uint8)

        # 获取轮廓点坐标
        points = []
        for idx in face_oval_indices:
            landmark = face_landmarks.landmark[idx]
            px = int(landmark.x * fw)
            py = int(landmark.y * fh)
            points.append([px, py])

        points = np.array(points, dtype=np.int32)

        # 填充面部轮廓
        cv2.fillPoly(mask, [points], 255)

        # 获取皮肤颜色区域
        skin_color_mask = self._detect_skin_by_color(face_img)

        # 合并
        combined_mask = cv2.bitwise_and(mask, skin_color_mask)

        # 放回原图
        full_mask = np.zeros((h, w), dtype=np.uint8)
        full_mask[y1:y2, x1:x2] = combined_mask

        return full_mask

    def __del__(self):
        """清理资源"""
        if hasattr(self, 'segmentor'):
            self.segmentor.close()
        if hasattr(self, 'face_mesh'):
            self.face_mesh.close()


def test_segmentor():
    """测试皮肤分割器"""
    segmentor = SkinSegmentor()

    # 创建测试图像
    test_image = np.ones((480, 640, 3), dtype=np.uint8) * 200

    # 获取皮肤mask
    mask = segmentor.get_skin_mask(test_image)
    print(f"Mask shape: {mask.shape}, unique values: {np.unique(mask)}")

    return mask


if __name__ == "__main__":
    test_segmentor()
