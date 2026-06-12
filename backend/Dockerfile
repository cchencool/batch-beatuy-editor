FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    PATH="/app/.venv/bin:$PATH"

# 系统依赖（OpenCV、InsightFace 等需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# 复制依赖配置并安装
COPY pyproject.toml README.md ./
RUN uv sync --no-dev

# 下载 InsightFace buffalo_l 模型
RUN mkdir -p ~/.insightface/models/buffalo_l && \
    curl -fSL -o /tmp/buffalo_l.zip \
    https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip && \
    unzip -o /tmp/buffalo_l.zip -d ~/.insightface/models/buffalo_l/ && \
    rm /tmp/buffalo_l.zip

# 复制应用代码
COPY . .

# 确保数据目录存在
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
