# 批量指定人员美颜工具

一款基于AI的批量人像美颜工具，支持指定特定人员进行选择性磨皮处理。

## 功能特点

- 🎯 **指定人员美颜** - 上传参考照片注册目标人员，系统自动识别并仅对目标人员进行美颜
- 👥 **多人支持** - 支持同时指定多个目标人员
- ⚙️ **参数可调** - 磨皮强度、边缘保护、细节保留均可自定义
- 📊 **处理报告** - 详细的处理结果统计和报告
- 👁️ **预览对比** - 处理前后对比预览，滑条模式直观对比
- 🌙 **暗色模式** - 支持亮色/暗色主题切换

## 技术栈

### 后端
- **框架**: FastAPI
- **AI处理**:
  - 人脸检测: MediaPipe Face Detection
  - 人脸识别: InsightFace (ArcFace)
  - 皮肤分割: MediaPipe Selfie Segmentation
  - 磨皮算法: 表面模糊 (Surface Blur)
- **数据库**: SQLite
- **包管理**: uv

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS
- **状态管理**: Zustand
- **路由**: React Router

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- uv（Python包管理工具）
- npm 或 pnpm

### 安装后端

使用 uv 安装依赖（推荐）：

```bash
cd backend
uv sync
```

启动后端服务：
```bash
uv run beauty-server
```

或者使用 uvicorn 直接运行：
```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档。

### 安装前端

```bash
cd frontend
npm install
```

启动前端开发服务器：
```bash
npm run dev
```

访问 http://localhost:5173 查看应用。

## 使用流程

1. **注册目标人员** - 进入"目标人员"页面，上传姓名和参考照片
2. **批量处理** - 进入"批量处理"页面，上传需要处理的图片
3. **选择目标** - 选择需要美颜的目标人员
4. **调整参数** - 设置磨皮强度等参数
5. **开始处理** - 点击"开始处理"按钮
6. **预览结果** - 处理完成后进入"预览审阅"页面查看效果
7. **下载报告** - 在"处理报告"页面查看统计和下载结果

## 项目结构

```
beauty-project/
├── backend/              # Python后端
│   ├── app/
│   │   ├── api/         # API路由
│   │   ├── core/        # 核心AI处理模块
│   │   ├── models/      # 数据模型
│   │   └── main.py      # FastAPI入口
│   ├── data/            # 数据存储
│   └── pyproject.toml   # uv项目配置
│
├── frontend/            # React前端
│   ├── src/
│   │   ├── components/  # 通用组件
│   │   ├── pages/       # 页面组件
│   │   ├── stores/      # 状态管理
│   │   └── services/    # API服务
│   └── package.json
│
└── README.md
```

## 开发计划

- [x] 项目初始化和基础架构
- [x] 后端核心AI处理模块
- [x] 后端API开发
- [x] 前端页面开发
- [ ] 集成测试和优化
- [ ] 文档完善

## 许可证

MIT
