# AGENTS.md — 批量指定人员美颜工具

## 项目概览

双包 monorepo（无 monorepo 工具，两个独立目录）：
- `backend/` — Python FastAPI 后端（uv 管理）
- `frontend/` — React 19 + Vite + TailwindCSS v4 前端

无测试、无 CI（`.github/workflows` 不存在）。

## 启动命令

```bash
# 后端（backend/ 目录下）
uv sync              # 安装依赖（首次或依赖变更后）
uv run beauty-server # 启动 FastAPI（uvicorn, reload=True, port 8000）
# 或：uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端（frontend/ 目录下）
npm install          # 安装依赖
npm run dev          # Vite dev server, port 5173
npm run build        # tsc -b && vite build（含类型检查）
npm run lint         # ESLint
```

## 架构要点

- 前端通过 Vite proxy 将 `/api` → `localhost:8000`，开发时无需 CORS 配置（`vite.config.ts`）。
- 后端路由：`/api/persons/`、`/api/tasks/`、`/api/files/`，入口 `app.main:app`。
- 数据库：SQLite + SQLAlchemy async，自动建表（`backend/data/beauty.db`）。
- `uploaded_files` 已持久化到 `backend/data/uploaded_files.json`，服务重启后不丢失。
- 工作路径配置保存在 `backend/data/settings.json`，默认 `/Users/chen/Development/debug/batch-beatuy-editor`。
- 路径历史保存在 `backend/data/path_history.json`。
- `uv run beauty-server` 等价于 `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`（`backend/app/main.py:68-76`）。

## 关键功能

### 人脸识别
- 使用 InsightFace（buffalo_l 模型），模型需手动下载到 `~/.insightface/models/buffalo_l/`
- 识别阈值：0.4（余弦距离，越小越相似）
- 匹配距离会在处理报告中显示

### 目录浏览
- 所有目录浏览限制在工作路径内（安全限制）
- API：`GET /api/files/work-dirs?path=...`
- 输入/输出目录只能选择工作路径下的子目录

### 缩略图
- 选择输入目录后自动生成缩略图到 `{工作路径}/thumbnails/{目录名}/`
- API：`POST /api/files/thumbnails` 生成，`GET /api/files/thumb` 获取

### 图片服务
- `GET /api/files/image?path=...` — 获取原始图片
- `GET /api/files/thumb?path=...` — 获取缩略图（优先），无缩略图时返回原图

## 注意事项

- 前端 `npm run build` 会先执行 `tsc -b`（配置了 `noUnusedLocals`、`noUnusedParameters`、`verbatimModuleSyntax`），类型错误会阻止构建。
- 后端无类型检查/格式化脚本；前端使用 ESLint flat config（`eslint.config.js`）。
- 后端依赖包括 `insightface`、`mediapipe`、`opencv-python`，首次 `uv sync` 可能较慢。
- 使用 npm（非 pnpm/yarn）。
- 代码注释使用中文。
