# 批量指定人员美颜工具 - 后端服务

## 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

## 运行服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问 http://localhost:8000/docs 查看API文档。

## 项目结构

```
backend/
├── app/
│   ├── main.py         # FastAPI入口
│   ├── api/            # API路由
│   │   ├── persons.py  # 人员管理API
│   │   ├── tasks.py    # 任务管理API
│   │   └── files.py    # 文件处理API
│   ├── core/           # 核心处理模块
│   │   ├── detector.py # 人脸检测
│   │   ├── recognizer.py # 人脸识别
│   │   ├── segmentor.py # 皮肤分割
│   │   ├── beautifier.py # 磨皮处理
│   │   └── pipeline.py # 完整处理流水线
│   ├── models/         # 数据模型
│   ├── services/       # 业务逻辑
│   └── utils/          # 工具函数
├── data/               # 数据存储
└── requirements.txt
```

## API接口

### 人员管理
- `GET /api/persons/` - 获取人员列表
- `GET /api/persons/{id}` - 获取人员详情
- `POST /api/persons/` - 创建人员（上传参考照片）
- `PUT /api/persons/{id}` - 更新人员信息
- `DELETE /api/persons/{id}` - 删除人员

### 文件处理
- `POST /api/files/upload` - 上传文件
- `GET /api/files/list` - 获取已上传文件列表
- `DELETE /api/files/{id}` - 删除文件

### 任务管理
- `GET /api/tasks/` - 获取任务列表
- `GET /api/tasks/{id}` - 获取任务详情
- `POST /api/tasks/` - 创建批量处理任务
- `GET /api/tasks/{id}/progress` - 获取任务进度
- `POST /api/tasks/{id}/pause` - 暂停任务
- `POST /api/tasks/{id}/cancel` - 取消任务
- `GET /api/tasks/{id}/download` - 下载处理结果

## 技术栈

- **框架**: FastAPI
- **AI处理**: MediaPipe + InsightFace + OpenCV
- **数据库**: SQLite
