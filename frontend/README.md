# 批量指定人员美颜工具 - 前端

## 安装依赖

```bash
npm install
```

## 开发

```bash
npm run dev
```

打开 http://localhost:5173 查看应用。

## 构建

```bash
npm run build
```

## 项目结构

```
frontend/
├── src/
│   ├── components/     # 通用组件
│   │   ├── Layout.tsx  # 布局组件
│   │   ├── Toast.tsx   # 提示组件
│   │   └── ui/         # UI组件库
│   ├── pages/          # 页面组件
│   │   ├── Dashboard.tsx    # 仪表盘
│   │   ├── Persons.tsx      # 目标人员管理
│   │   ├── BatchProcess.tsx # 批量处理
│   │   ├── Review.tsx       # 预览审阅
│   │   └── Report.tsx       # 处理报告
│   ├── stores/         # Zustand状态管理
│   ├── services/       # API服务
│   ├── types/          # TypeScript类型定义
│   └── utils/          # 工具函数
└── package.json
```

## 技术栈

- React 18 + TypeScript
- Vite
- TailwindCSS
- React Router
- Zustand
- Axios
- Lucide React Icons
