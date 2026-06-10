# 批量指定人员美颜工具

一款基于AI的批量人像美颜工具，支持指定特定人员进行选择性磨皮处理。

## 功能特点

- 🎯 **指定人员美颜** - 上传参考照片注册目标人员，系统自动识别并仅对目标人员进行美颜
- 👥 **多人支持** - 支持同时指定多个目标人员
- ⚙️ **参数可调** - 磨皮强度、边缘保护、细节保留均可自定义
- 📊 **处理报告** - 详细的处理结果统计和报告，包含匹配置信度
- 👁️ **预览对比** - 处理前后对比预览，滑条模式直观对比
- 🌙 **暗色模式** - 支持亮色/暗色主题切换
- 📁 **目录浏览** - 支持直接选择输入/输出目录，自动生成缩略图
- 🔒 **安全限制** - 目录浏览限制在工作路径内，防止路径遍历攻击

## 技术栈

### 后端
- **框架**: FastAPI
- **AI处理**:
  - 人脸检测: OpenCV Haar Cascade + InsightFace
  - 人脸识别: InsightFace (ArcFace, buffalo_l)
  - 皮肤分割: 颜色空间检测 (HSV + YCrCb)
  - 磨皮算法: 双边滤波 + 高频细节保留
- **数据库**: SQLite + SQLAlchemy async
- **包管理**: uv

### 前端
- **框架**: React 19 + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS v4
- **状态管理**: Zustand
- **路由**: React Router

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- uv（Python包管理工具）
- npm

### 安装后端

```bash
cd backend
uv sync
uv run beauty-server
```

访问 http://localhost:8000/docs 查看API文档。

### 安装前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 查看应用。

### 人脸识别模型

首次使用需要下载 InsightFace 模型：

```bash
mkdir -p ~/.insightface/models/buffalo_l
cd ~/.insightface/models/buffalo_l
curl -L -o buffalo_l.zip https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip
unzip buffalo_l.zip
```

## 使用流程

1. **设置工作路径** - 进入"设置"页面，配置工作目录
2. **注册目标人员** - 进入"目标人员"页面，上传姓名和参考照片
3. **批量处理** - 进入"批量处理"页面，选择输入目录并勾选图片
4. **选择目标** - 选择需要美颜的目标人员
5. **调整参数** - 设置磨皮强度等参数
6. **开始处理** - 点击"开始处理"按钮
7. **预览结果** - 处理完成后进入"预览审阅"页面查看效果
8. **下载报告** - 在"处理报告"页面查看统计和下载结果

## 项目结构

```
batch-beatuy-editor/
├── backend/                # Python后端
│   ├── app/
│   │   ├── api/           # API路由 (persons, tasks, files)
│   │   ├── core/          # 核心AI处理模块
│   │   │   ├── pipeline.py    # 处理流水线
│   │   │   ├── detector.py    # 人脸检测
│   │   │   ├── recognizer.py  # 人脸识别
│   │   │   ├── segmentor.py   # 皮肤分割
│   │   │   └── beautifier.py  # 磨皮处理
│   │   ├── models/        # 数据模型
│   │   └── main.py        # FastAPI入口
│   ├── data/              # 数据存储 (gitignored)
│   └── pyproject.toml     # uv项目配置
│
├── frontend/              # React前端
│   ├── src/
│   │   ├── components/    # 通用组件 (PathSelector, Layout, etc.)
│   │   ├── pages/         # 页面组件
│   │   ├── stores/        # Zustand状态管理
│   │   ├── services/      # API服务
│   │   └── types/         # TypeScript类型定义
│   └── package.json
│
├── AGENTS.md              # AI助手指南
└── README.md
```

## 许可证

MIT
