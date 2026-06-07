"""
磨皮处理模块
实现表面模糊算法（Surface Blur）
"""
import cv2
import numpy as np
from typing import Optional, Tuple


class SkinBeautifier:
    """皮肤美颜处理器"""

    def __init__(
        self,
        strength: int = 50,
        edge_protection: int = 70,
        detail_preserve: int = 60
    ):
        """
        初始化美颜处理器

        Args:
            strength: 磨皮强度 0-100
            edge_protection: 边缘保护强度 0-100
            detail_preserve: 细节保留程度 0-100
        """
        self.strength = max(0, min(100, strength))
        self.edge_protection = max(0, min(100, edge_protection))
        self.detail_preserve = max(0, min(100, detail_preserve))

    def surface_blur(
        self,
        image: np.ndarray,
        mask: Optional[np.ndarray] = None,
        radius: Optional[int] = None,
        threshold: Optional[int] = None
    ) -> np.ndarray:
        """
        表面模糊算法（模拟Photoshop的表面模糊）

        原理：
        1. 对每个像素，检查其邻域像素的色差
        2. 色差小于阈值的像素参与模糊计算（平滑皮肤纹理）
        3. 色差大于阈值的像素保留原值（保护边缘）

        Args:
            image: 输入图像 (BGR)
            mask: 应用区域mask，None表示全图
            radius: 模糊半径，None根据strength自动计算
            threshold: 色差阈值，None根据edge_protection自动计算

        Returns:
            磨皮后的图像
        """
        h, w = image.shape[:2]

        # 自动计算参数
        if radius is None:
            # 根据强度计算半径：strength 0->1, 100->15
            radius = max(1, int(self.strength / 100 * 14) + 1)

        if threshold is None:
            # 根据边缘保护计算阈值：edge_protection 0->50, 100->10
            threshold = max(5, int(50 - self.edge_protection / 100 * 40))

        # 转换为float32以支持精确计算
        img_float = image.astype(np.float32)

        # 创建输出图像
        output = img_float.copy()

        # 对每个通道进行处理
        for c in range(3):
            channel = img_float[:, :, c]

            # 使用OpenCV的双边滤波作为基础
            # 双边滤波可以在平滑的同时保留边缘
            sigma_color = threshold * 2  # 颜色空间sigma
            sigma_space = radius * 2  # 坐标空间sigma

            blurred = cv2.bilateralFilter(
                channel,
                d=radius * 2 + 1,
                sigmaColor=sigma_color,
                sigmaSpace=sigma_space
            )

            # 根据强度混合原图和模糊图
            alpha = self.strength / 100
            output[:, :, c] = channel * (1 - alpha) + blurred * alpha

        # 如果有mask，只应用到mask区域
        if mask is not None:
            # 确保mask是float32并归一化
            if mask.dtype != np.float32:
                mask_float = mask.astype(np.float32) / 255.0
            else:
                mask_float = mask

            # 扩展mask维度以匹配图像
            if len(mask_float.shape) == 2:
                mask_float = np.expand_dims(mask_float, axis=2)

            # 混合
            output = img_float * (1 - mask_float) + output * mask_float

        # 转换回uint8
        output = np.clip(output, 0, 255).astype(np.uint8)

        return output

    def bilateral_smooth(
        self,
        image: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        双边滤波平滑（快速MVP方案）

        Args:
            image: 输入图像
            mask: 应用区域mask

        Returns:
            平滑后的图像
        """
        # 参数根据强度调整
        d = int(self.strength / 100 * 20) + 5
        sigma_color = self.strength * 1.5 + 20
        sigma_space = self.strength * 1.5 + 20

        # 应用双边滤波
        smoothed = cv2.bilateralFilter(
            image,
            d=d,
            sigmaColor=sigma_color,
            sigmaSpace=sigma_space
        )

        # 如果有mask，只应用到mask区域
        if mask is not None:
            if mask.dtype != np.float32:
                mask_float = mask.astype(np.float32) / 255.0
            else:
                mask_float = mask

            if len(mask_float.shape) == 2:
                mask_float = np.expand_dims(mask_float, axis=2)

            smoothed = image.astype(np.float32) * (1 - mask_float) + smoothed.astype(np.float32) * mask_float
            smoothed = smoothed.astype(np.uint8)

        return smoothed

    def high_pass_blend(
        self,
        image: np.ndarray,
        mask: Optional[np.ndarray] = None,
        detail_ratio: Optional[float] = None
    ) -> np.ndarray:
        """
        高频细节叠加（保持皮肤纹理真实感）

        原理：
        1. 原图 - 平滑图 = 高频细节层
        2. 衰减高频细节层
        3. 平滑图 + 衰减后的高频层 = 磨皮结果

        Args:
            image: 输入图像
            mask: 应用区域mask
            detail_ratio: 细节保留比例 0-1，None根据detail_preserve自动计算

        Returns:
            磨皮后的图像
        """
        if detail_ratio is None:
            detail_ratio = self.detail_preserve / 100

        # 获取平滑图
        smoothed = self.bilateral_smooth(image, None)  # 先全图平滑

        # 提取高频细节
        img_float = image.astype(np.float32)
        smooth_float = smoothed.astype(np.float32)

        # 高频 = 原图 - 平滑
        high_freq = img_float - smooth_float

        # 衰减高频
        high_freq_attenuated = high_freq * detail_ratio

        # 合成
        result = smooth_float + high_freq_attenuated
        result = np.clip(result, 0, 255).astype(np.uint8)

        # 应用mask
        if mask is not None:
            if mask.dtype != np.float32:
                mask_float = mask.astype(np.float32) / 255.0
            else:
                mask_float = mask

            if len(mask_float.shape) == 2:
                mask_float = np.expand_dims(mask_float, axis=2)

            result = img_float * (1 - mask_float) + result.astype(np.float32) * mask_float
            result = result.astype(np.uint8)

        return result

    def beautify(
        self,
        image: np.ndarray,
        mask: Optional[np.ndarray] = None,
        mode: str = "surface_blur"
    ) -> np.ndarray:
        """
        执行磨皮美颜

        Args:
            image: 输入图像 (BGR)
            mask: 皮肤区域mask
            mode: 磨皮模式 ("surface_blur", "bilateral", "high_pass")

        Returns:
            磨皮后的图像
        """
        if mode == "surface_blur":
            return self.surface_blur(image, mask)
        elif mode == "bilateral":
            return self.bilateral_smooth(image, mask)
        elif mode == "high_pass":
            return self.high_pass_blend(image, mask)
        else:
            raise ValueError(f"未知的磨皮模式: {mode}")

    def beautify_with_detail(
        self,
        image: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        带细节保留的磨皮（推荐方法）

        结合表面模糊和高频叠加，在平滑皮肤的同时保留毛孔等细节

        Args:
            image: 输入图像
            mask: 皮肤区域mask

        Returns:
            磨皮后的图像
        """
        # 第一步：表面模糊
        blurred = self.surface_blur(image, None)

        # 第二步：提取高频细节
        img_float = image.astype(np.float32)
        blur_float = blurred.astype(np.float32)

        # 使用高斯模糊获取低频
        kernel_size = int(self.strength / 100 * 30) | 1  # 确保是奇数
        low_freq = cv2.GaussianBlur(img_float, (kernel_size, kernel_size), 0)

        # 高频 = 原图 - 低频
        high_freq = img_float - low_freq

        # 衰减高频
        detail_ratio = self.detail_preserve / 100
        high_freq_attenuated = high_freq * detail_ratio

        # 合成
        result = blur_float + high_freq_attenuated
        result = np.clip(result, 0, 255).astype(np.uint8)

        # 应用mask
        if mask is not None:
            if mask.dtype != np.float32:
                mask_float = mask.astype(np.float32) / 255.0
            else:
                mask_float = mask

            if len(mask_float.shape) == 2:
                mask_float = np.expand_dims(mask_float, axis=2)

            result = img_float * (1 - mask_float) + result.astype(np.float32) * mask_float
            result = result.astype(np.uint8)

        return result


def test_beautifier():
    """测试磨皮处理器"""
    beautifier = SkinBeautifier(strength=50, edge_protection=70, detail_preserve=60)

    # 创建测试图像
    test_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)

    # 测试各种磨皮方法
    result1 = beautifier.surface_blur(test_image)
    result2 = beautifier.bilateral_smooth(test_image)
    result3 = beautifier.high_pass_blend(test_image)
    result4 = beautifier.beautify_with_detail(test_image)

    print(f"Surface blur result: {result1.shape}")
    print(f"Bilateral smooth result: {result2.shape}")
    print(f"High pass blend result: {result3.shape}")
    print(f"Beautify with detail result: {result4.shape}")


if __name__ == "__main__":
    test_beautifier()
