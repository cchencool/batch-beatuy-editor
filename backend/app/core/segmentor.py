"""
皮肤分割模块
使用MediaPipe Tasks Vision API (v0.10.11+) + 颜色空间检测
"""
import cv2
import numpy as np
from typing import List, Dict, Optional



class SkinSegmentor:
    """皮肤分割器 (MediaPipe Tasks Vision API)"""

    def __init__(self, model_selection: int = 0):
        """
        初始化皮肤分割器
        使用颜色空间检测作为主要方法（不依赖模型下载）
        """
        self.model_selection = model_selection

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

        # 使用颜色空间检测皮肤
        skin_mask = self._detect_skin_by_color(image)

        if face_bbox is not None:
            x, y, width, height = face_bbox
            pad = 0.3
            x1 = max(0, int(x - width * pad))
            y1 = max(0, int(y - height * pad))
            x2 = min(w, int(x + width * (1 + pad)))
            y2 = min(h, int(y + height * (1 + pad)))

            # 限制在扩展的面部区域内
            region_mask = np.zeros((h, w), dtype=np.uint8)
            region_mask[y1:y2, x1:x2] = 255
            skin_mask = cv2.bitwise_and(skin_mask, region_mask)

        return skin_mask

    def _detect_skin_by_color(self, image: np.ndarray) -> np.ndarray:
        """通过多颜色空间检测皮肤区域"""
        h, w = image.shape[:2]

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

        if keypoints:
            # 创建排除区域的mask
            exclude_mask = np.zeros((h, w), dtype=np.uint8)

            # 排除眼睛区域
            if exclude_eyes and 'left_eye' in keypoints and 'right_eye' in keypoints:
                left_eye = keypoints['left_eye']
                right_eye = keypoints['right_eye']

                eye_radius = int(width * 0.08)
                cv2.circle(exclude_mask, left_eye, eye_radius, 255, -1)
                cv2.circle(exclude_mask, right_eye, eye_radius, 255, -1)

            # 排除嘴巴区域
            if exclude_mouth and 'mouth_center' in keypoints:
                mouth = keypoints['mouth_center']
                mouth_radius = int(width * 0.1)
                cv2.circle(exclude_mask, mouth, mouth_radius, 255, -1)

            # 排除鼻子区域
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

    def __del__(self):
        """清理资源"""
        pass


def test_segmentor():
    """测试皮肤分割器"""
    segmentor = SkinSegmentor()
    test_image = np.ones((480, 640, 3), dtype=np.uint8) * 200
    mask = segmentor.get_skin_mask(test_image)
    print(f"Mask shape: {mask.shape}, unique values: {np.unique(mask)}")
    return mask


if __name__ == "__main__":
    test_segmentor()
