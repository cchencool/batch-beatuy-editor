import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Maximize2, ZoomIn, ZoomOut, RotateCcw, Focus, ChevronsLeftRight } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { tasksApi, filesApi } from '../services/api';
import type { Task, ImageResult, FaceDetail } from '../types';

export function Review() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSlider, setShowSlider] = useState(true);
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [hoveredFace, setHoveredFace] = useState<{
    name: string;
    distance?: number;
    x: number;
    y: number;
  } | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 缩放状态
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const scaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingImage = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const spacePressed = useRef(false);
  // 分隔线拖拽状态
  const isDraggingDivider = useRef(false);
  // 平移手势状态（光标反馈 + 区分点击与拖拽）
  const [isPanning, setIsPanning] = useState(false);
  const panMoved = useRef(0);
  const clickTimer = useRef<number | null>(null);
  const thumbNavRef = useRef<HTMLDivElement>(null);
  // 图片原始尺寸
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const imgNaturalRef = useRef({ w: 0, h: 0 });

  // 保持 ref 与 state 同步
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { translateXRef.current = translateX; }, [translateX]);
  useEffect(() => { translateYRef.current = translateY; }, [translateY]);
  useEffect(() => { imgNaturalRef.current = imgNatural; }, [imgNatural]);

  useEffect(() => {
    if (taskId) {
      loadTask(parseInt(taskId));
    } else {
      loadLatestTask();
    }
  }, [taskId]);

  useEffect(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setHoveredFace(null);
  }, [currentIndex]);

  const loadLatestTask = async () => {
    try {
      setLoading(true);
      const res = await tasksApi.list();
      const completedTask = res.tasks.find(t => t.status === 'completed' && t.total_count > 0);
      if (completedTask) {
        navigate(`/review/${completedTask.id}`, { replace: true });
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setLoading(false);
    }
  };

  const loadTask = async (id: number) => {
    try {
      setLoading(true);
      const data = await tasksApi.get(id);
      setTask(data);
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setLoading(false);
    }
  };

  // 空格键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spacePressed.current = true;
      }
      if (!task) return;
      switch (e.key) {
        case 'ArrowLeft':
          setCurrentIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          setCurrentIndex((prev) => Math.min(task.results.length - 1, prev + 1));
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case '0':
          resetZoom();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed.current = false;
        isDraggingImage.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [task]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // 分隔线拖拽 - 使用 refs 避免 stale closure
  const handleDividerDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingDivider.current = true;

    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingDivider.current) return;
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const W = rect.width;
      const center = W / 2;
      const s = scaleRef.current;
      const tx = translateXRef.current;
      
      // 屏幕坐标转换为 transform div 内部坐标
      const localX = (mouseX - center - tx) / s + center;
      const percentage = (localX / W) * 100;
      
      setSliderPosition(Math.max(0, Math.min(100, percentage)));
    };

    const handleMouseUp = () => {
      isDraggingDivider.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 单击容器移动分隔线（延迟200ms以区分双击；拖拽平移后不触发）
  const handleContainerClick = (e: React.MouseEvent) => {
    if (!showSlider || !containerRef.current) return;
    if (panMoved.current > 4) return;

    const { clientX } = e;
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const W = rect.width;
      const center = W / 2;
      const s = scaleRef.current;
      const tx = translateXRef.current;
      const localX = (mouseX - center - tx) / s + center;
      setSliderPosition(Math.max(0, Math.min(100, (localX / W) * 100)));
    }, 200);
  };

  // 双击：放大状态复位，否则以点击位置为中心放大到2倍
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (scaleRef.current > 1) {
      resetZoom();
    } else {
      zoomAtPoint(e.clientX, e.clientY, 1, 2);
    }
  };

  // 切换图片时，缩略图导航中的当前项自动滚动到可视区域
  useEffect(() => {
    thumbNavRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  // 卸载时清理未执行的单击定时器
  useEffect(() => () => {
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
  }, []);

  // 以指定屏幕坐标为中心缩放（滚轮与双击共用）
  const zoomAtPoint = (clientX: number, clientY: number, factor: number, absoluteScale?: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const s = scaleRef.current;
    const tx = translateXRef.current;
    const ty = translateYRef.current;
    const newScale = Math.max(0.5, Math.min(5, absoluteScale ?? s * factor));

    // 保持鼠标下方图片点不变：
    // screenX = (imgX - cx) * s + cx + tx  →  imgX = (screenX - cx - tx) / s + cx
    const imgX = (mouseX - cx - tx) / s + cx;
    const imgY = (mouseY - cy - ty) / s + cy;

    setScale(newScale);
    setTranslateX(mouseX - cx - (imgX - cx) * newScale);
    setTranslateY(mouseY - cy - (imgY - cy) * newScale);
  };

  // 在预览区域内接管滚轮与 Trackpad 捏合，避免触发浏览器整页缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setHoveredFace(null);

      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? container.clientHeight
          : 1;
      const isPinch = e.ctrlKey || e.metaKey;
      const sensitivity = isPinch ? 0.01 : 0.0018;
      zoomAtPoint(e.clientX, e.clientY, Math.exp(-e.deltaY * unit * sensitivity));
    };

    // Safari 的 Trackpad 捏合通过 gesture 事件而不是 ctrl+wheel 触发
    let gestureStartScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartScale = scaleRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const gesture = e as Event & { scale: number; clientX: number; clientY: number };
      zoomAtPoint(gesture.clientX, gesture.clientY, 1, gestureStartScale * gesture.scale);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('gesturestart', onGestureStart);
    container.addEventListener('gesturechange', onGestureChange);
    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('gesturestart', onGestureStart);
      container.removeEventListener('gesturechange', onGestureChange);
    };
  }, [loading, task, currentIndex]);

  // 鼠标按下：放大后左键直接平移；右键或空格+左键任意缩放级别均可平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || (e.button === 0 && (scale > 1 || spacePressed.current))) {
      isDraggingImage.current = true;
      setIsPanning(true);
      setHoveredFace(null);
      panMoved.current = 0;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingImage.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      panMoved.current += Math.abs(dx) + Math.abs(dy);
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setTranslateX(prev => prev + dx);
      setTranslateY(prev => prev + dy);
    }
  };

  const handleMouseUp = () => {
    isDraggingImage.current = false;
    setIsPanning(false);
  };

  const resetZoom = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  // 聚焦人脸
  const focusOnFace = () => {
    if (!task || !containerRef.current) return;
    const result = task.results[currentIndex];
    if (!result.face_bboxes || result.face_bboxes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const bbox of result.face_bboxes) {
      const [x, y, w, h] = bbox;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    const padding = 100;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = maxX + padding;
    maxY = maxY + padding;

    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // 使用结果中记录的原图尺寸（bbox 坐标系与原图一致，与显示图分辨率无关）
    const iw = result.image_width || imgNaturalRef.current.w || cw;
    const ih = result.image_height || imgNaturalRef.current.h || ch;

    // 人脸在图片中的中心点
    const faceCenterImgX = (minX + maxX) / 2;
    const faceCenterImgY = (minY + maxY) / 2;
    const faceW = maxX - minX;
    const faceH = maxY - minY;

    // object-fit: contain 映射
    const scale = Math.min(cw / iw, ch / ih);
    const displayW = iw * scale;
    const displayH = ih * scale;
    const offsetX = (cw - displayW) / 2;
    const offsetY = (ch - displayH) / 2;

    // 人脸在容器中的显示位置
    const displayFx = faceCenterImgX * scale + offsetX;
    const displayFy = faceCenterImgY * scale + offsetY;

    // 目标缩放：让脸约占容器 50%
    const targetScale = Math.min(cw / (faceW * scale) * 0.5, ch / (faceH * scale) * 0.5, 3);

    // 计算 translate 让人脸居中
    // screenPos = (displayPos - containerCenter) * targetScale + containerCenter + tx
    // 设 screenPos = containerCenter:
    // tx = (containerCenter - displayPos) * targetScale
    const newTx = (cw / 2 - displayFx) * targetScale;
    const newTy = (ch / 2 - displayFy) * targetScale;

    setScale(targetScale);
    setTranslateX(newTx);
    setTranslateY(newTy);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!task || task.results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">没有可审阅的图片</p>
        <Button className="mt-4" onClick={() => navigate('/batch')}>去批量处理</Button>
      </div>
    );
  }

  const currentResult = task.results[currentIndex];
  const originalPath = task.input_files.find(f => f.id === currentResult.file_id)?.path ||
    currentResult.output_path?.replace(/beautified_/, 'original_') || '';

  // 默认加载预览图（最长边2048），放大查看细节时切换原图
  const useFullRes = scale >= 2;
  const originalSrc = useFullRes
    ? filesApi.getImageUrl(originalPath)
    : filesApi.getPreviewUrl(originalPath);
  const processedSrc = useFullRes
    ? filesApi.getImageUrl(currentResult.output_path || '')
    : filesApi.getPreviewUrl(currentResult.output_path || '');

  const faceOverlays: FaceDetail[] = currentResult.face_details ?? (currentResult.face_bboxes ?? []).map((bbox) => ({
    bbox,
    person_id: -1,
    person_name: '目标人员',
  }));
  const faceImageWidth = currentResult.image_width || imgNatural.w;
  const faceImageHeight = currentResult.image_height || imgNatural.h;

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0) {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  const handleFaceHover = (e: React.MouseEvent, name: string, distance?: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoveredFace({
      name: name || '目标人员',
      distance,
      x: Math.max(8, Math.min(x + 14, rect.width - 180)),
      y: Math.max(8, Math.min(y + 14, rect.height - 58)),
    });
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background flex flex-col' : 'animate-fade-in'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isFullscreen ? 'p-4 border-b' : 'mb-4'}`}>
        <div>
          <h1 className="text-2xl font-bold">预览审阅</h1>
          <p className="text-muted-foreground">{currentIndex + 1} / {task.results.length}</p>
        </div>
        <div className="flex gap-2 items-center">
          {scale > 1 && (
            <Button variant="outline" size="sm" onClick={resetZoom}>
              <RotateCcw className="w-4 h-4 mr-1" />重置
            </Button>
          )}
          {currentResult.face_bboxes && currentResult.face_bboxes.length > 0 && (
            <Button variant="outline" size="sm" onClick={focusOnFace}>
              <Focus className="w-4 h-4 mr-1" />聚焦人脸
            </Button>
          )}
          <Button variant="outline" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4 mr-2" />{isFullscreen ? '退出全屏' : '全屏'}
          </Button>
          {!isFullscreen && (
            <Button onClick={() => navigate(`/report/${task.id}`)}>查看报告</Button>
          )}
        </div>
      </div>

      <div className={`flex gap-4 flex-1 min-h-0 ${isFullscreen ? 'px-4 pb-4' : ''}`}>
        {/* Main Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="flex-1 flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col">
              {currentResult.output_url ? (
                <div
                  ref={containerRef}
                  className="relative flex-1 min-h-[60vh] bg-black rounded-lg overflow-hidden"
                  style={{
                    cursor: isPanning ? 'grabbing' : scale > 1 ? 'grab' : showSlider ? 'col-resize' : 'default',
                    touchAction: 'none',
                    overscrollBehavior: 'contain',
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={handleContainerClick}
                  onDoubleClick={handleDoubleClick}
                >
                  {currentResult.status === 'success' ? (
                    /* 对比模式：两张图叠放 + 分隔线 */
                    <div
                      className="absolute inset-0"
                      style={{
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: isDraggingImage.current || isDraggingDivider.current ? 'none' : 'transform 0.15s ease-out',
                      }}
                    >
                      {/* 底层 - 原图 */}
                      <img
                        key={originalSrc}
                        src={originalSrc}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain select-none animate-fade-in"
                        style={{
                          clipPath: showSlider ? `inset(0 ${100 - sliderPosition}% 0 0)` : undefined
                        }}
                        draggable={false}
                      />

                      {/* 上层 - 处理图 */}
                      <img
                        key={processedSrc}
                        src={processedSrc}
                        alt="Processed"
                        className="absolute inset-0 w-full h-full object-contain select-none"
                        onLoad={handleImgLoad}
                        style={{
                          clipPath: showSlider ? `inset(0 0 0 ${sliderPosition}%)` : undefined
                        }}
                        draggable={false}
                      />

                      {/* 分隔线 - 在 transform 内部，用 scaleX 反向缩放保持厚度不变 */}
                      {showSlider && (
                        <div
                          className="absolute top-0 bottom-0 z-10 cursor-col-resize select-none"
                          style={{
                            left: `${sliderPosition}%`,
                            width: '20px',
                            transform: `translateX(-50%) scaleX(${1 / scale})`,
                            transformOrigin: 'center center'
                          }}
                          onMouseDown={handleDividerDragStart}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="w-[1.5px] h-full mx-auto bg-white shadow-lg" />
                          {/* 中央圆形拖拽手柄 */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/95 shadow-lg flex items-center justify-center pointer-events-none">
                            <ChevronsLeftRight className="w-4 h-4 text-gray-600" />
                          </div>
                        </div>
                      )}

                      {/* 标签 */}
                      {showSlider && (
                        <>
                          <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm pointer-events-none select-none">原图</div>
                          <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/60 text-white text-sm pointer-events-none select-none">处理后</div>
                        </>
                      )}

                      {/* 与图片共用 viewBox 和 transform，缩放、平移时人脸框保持贴合 */}
                      {faceImageWidth > 0 && faceImageHeight > 0 && faceOverlays.length > 0 && (
                        <svg
                          className="absolute inset-0 z-20 w-full h-full"
                          viewBox={`0 0 ${faceImageWidth} ${faceImageHeight}`}
                          preserveAspectRatio="xMidYMid meet"
                          style={{ pointerEvents: 'none' }}
                        >
                          {faceOverlays.map((face, index) => {
                            const [x, y, w, h] = face.bbox;
                            return (
                              <g
                                key={`${face.person_id}-${index}`}
                                style={{ pointerEvents: 'auto', cursor: 'help' }}
                                onMouseEnter={(e) => handleFaceHover(e, face.person_name, face.match_distance)}
                                onMouseMove={(e) => handleFaceHover(e, face.person_name, face.match_distance)}
                                onMouseLeave={() => setHoveredFace(null)}
                              >
                                <rect
                                  x={x}
                                  y={y}
                                  width={w}
                                  height={h}
                                  fill={showFaceBoxes ? 'rgba(34, 197, 94, 0.08)' : 'transparent'}
                                  stroke={showFaceBoxes ? '#22c55e' : 'none'}
                                  strokeWidth={2}
                                  vectorEffect="non-scaling-stroke"
                                />
                              </g>
                            );
                          })}
                        </svg>
                      )}
                    </div>
                  ) : (
                    /* 非对比模式：单图 */
                    <div
                      className="absolute inset-0"
                      style={{
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: isDraggingImage.current ? 'none' : 'transform 0.15s ease-out',
                      }}
                    >
                      <img
                        key={processedSrc}
                        src={processedSrc}
                        alt={currentResult.filename}
                        className="w-full h-full object-contain select-none animate-fade-in"
                        draggable={false}
                      />
                      <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm pointer-events-none select-none">
                        {currentResult.status === 'no_target' ? '未匹配到目标' : '处理失败'}
                      </div>
                    </div>
                  )}

                  {hoveredFace && (
                    <div
                      className="absolute z-30 max-w-52 px-3 py-2 rounded-md bg-black/85 text-white shadow-lg pointer-events-none select-none"
                      style={{ left: hoveredFace.x, top: hoveredFace.y }}
                    >
                      <p className="text-sm font-medium truncate">{hoveredFace.name}</p>
                      {hoveredFace.distance !== undefined && (
                        <p className="text-xs text-white/70 mt-0.5">匹配距离 {hoveredFace.distance.toFixed(4)}</p>
                      )}
                    </div>
                  )}

                  {/* 缩放指示器 */}
                  {scale > 1 && (
                    <div className="absolute bottom-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm z-20">
                      {Math.round(scale * 100)}%
                    </div>
                  )}

                  {/* 操作提示 */}
                  {scale > 1 && (
                    <div className="absolute bottom-4 right-4 px-2 py-1 rounded bg-black/60 text-white text-xs z-20">
                      双指捏合缩放 · 拖拽平移 · 双击复位
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-[60vh] bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">{currentResult.error_message || '无法加载图片'}</p>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}>
                  <ChevronLeft className="w-4 h-4 mr-1" />上一张
                </Button>
                <div className="flex gap-2 items-center">
                  <Button variant={showSlider ? 'primary' : 'outline'} size="sm" onClick={() => setShowSlider(!showSlider)}>
                    对比模式
                  </Button>
                  <label
                    className={`flex items-center gap-1.5 text-sm select-none ${faceOverlays.length > 0 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                    title="框选已识别并美颜的目标人脸；悬浮人脸可查看匹配人物"
                  >
                    <input
                      type="checkbox"
                      checked={showFaceBoxes}
                      onChange={(e) => setShowFaceBoxes(e.target.checked)}
                      disabled={faceOverlays.length === 0}
                      className="w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                    />
                    匹配目标
                  </label>
                  <Button variant="outline" size="sm" onClick={() => setScale(prev => Math.min(5, prev * 1.2))} disabled={scale >= 5}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScale(prev => Math.max(0.5, prev * 0.8))} disabled={scale <= 0.5}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">双指捏合 / 滚轮缩放 · 拖拽平移 · 双击缩放</span>
                </div>
                <Button variant="outline" onClick={() => setCurrentIndex(prev => Math.min(task.results.length - 1, prev + 1))} disabled={currentIndex === task.results.length - 1}>
                  下一张<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          {!isFullscreen && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">文件名</p>
                    <p className="font-medium truncate">{currentResult.filename}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">状态</p>
                    <p className={`font-medium ${currentResult.status === 'success' ? 'text-green-600' : currentResult.status === 'no_target' ? 'text-yellow-600' : 'text-red-600'}`}>
                      {currentResult.status === 'success' ? '成功' : currentResult.status === 'no_target' ? '无目标' : '失败'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">检测到人脸</p>
                    <p className="font-medium" title="图片中检测到的所有人脸数量（包括背景中的）">{currentResult.faces_detected}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">匹配目标</p>
                    <p className="font-medium" title="与注册人员匹配的人脸数量">{currentResult.targets_matched}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Thumbnail Navigation */}
        <div className={`${isFullscreen ? 'w-48' : 'w-64'} flex-shrink-0`}>
          <Card className="h-full">
            <CardContent className="p-4 h-full overflow-y-auto">
              <div ref={thumbNavRef}>
                <h3 className="font-medium mb-3">缩略图导航</h3>
                <div className="grid grid-cols-2 gap-2">
                  {task.results.map((result, index) => (
                    <ThumbnailItem key={result.file_id} result={result} isActive={index === currentIndex} onClick={() => setCurrentIndex(index)} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      {!isFullscreen && (
        <Card className="mt-4">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span><kbd className="px-1.5 py-0.5 bg-muted rounded">←</kbd><kbd className="px-1.5 py-0.5 bg-muted rounded">→</kbd> 切换</span>
              <span><kbd className="px-1.5 py-0.5 bg-muted rounded">F</kbd> 全屏</span>
              <span><kbd className="px-1.5 py-0.5 bg-muted rounded">捏合 / 滚轮</kbd> 缩放</span>
              <span><kbd className="px-1.5 py-0.5 bg-muted rounded">双击</kbd> 缩放/复位</span>
              <span><kbd className="px-1.5 py-0.5 bg-muted rounded">0</kbd> 重置</span>
              <span><kbd className="px-1.5 py-0.5 bg-muted rounded">拖拽</kbd> 平移</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ThumbnailItem({ result, isActive, onClick }: { result: ImageResult; isActive: boolean; onClick: () => void }) {
  const statusColors = { success: 'ring-green-500', no_target: 'ring-yellow-500', failed: 'ring-red-500' };
  return (
    <div
      data-active={isActive}
      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer ring-2 transition-all ${isActive ? statusColors[result.status] : 'ring-transparent hover:ring-muted-foreground/50'}`}
      onClick={onClick}
    >
      <div className="w-full h-full bg-muted flex items-center justify-center">
        {result.output_path ? (
          <img
            src={filesApi.getImageUrl(result.thumbnail_path || result.output_path)}
            alt={result.filename}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="text-muted-foreground text-xs">暂无预览</div>
        )}
      </div>
      {result.status === 'success' && (
        <div className="absolute bottom-1 right-1 p-0.5 rounded-full bg-green-500 text-white">
          <Check className="w-3 h-3" />
        </div>
      )}
      {result.status === 'no_target' && (
        <div className="absolute bottom-1 right-1 p-0.5 rounded-full bg-yellow-500 text-white">
          <AlertTriangle className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}
