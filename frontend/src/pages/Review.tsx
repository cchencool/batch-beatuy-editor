import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Maximize2, ZoomIn, ZoomOut, RotateCcw, Focus } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { tasksApi, filesApi } from '../services/api';
import type { Task, ImageResult } from '../types';

export function Review() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSlider, setShowSlider] = useState(true);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 缩放状态
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (taskId) {
      loadTask(parseInt(taskId));
    } else {
      loadLatestTask();
    }
  }, [taskId]);

  // 切换图片时重置缩放
  useEffect(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, [currentIndex]);

  const loadLatestTask = async () => {
    try {
      setLoading(true);
      const res = await tasksApi.list();
      const completedTask = res.tasks.find(t => t.status === 'completed' && t.results.length > 0);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task]);

  // 监听全屏状态变化
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

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => {
      const newScale = Math.max(0.5, Math.min(5, prev * delta));
      return newScale;
    });
  }, []);

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTranslateX(prev => prev + dx);
    setTranslateY(prev => prev + dy);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // 重置缩放
  const resetZoom = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  // 聚焦人脸
  const focusOnFace = () => {
    if (!task) return;
    const result = task.results[currentIndex];
    if (!result.face_bboxes || result.face_bboxes.length === 0) return;

    // 计算所有人脸的边界框
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const bbox of result.face_bboxes) {
      const [x, y, w, h] = bbox;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    // 添加边距
    const padding = 50;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);

    // 计算缩放比例（假设图片是6000x4000）
    const imgWidth = 6000;
    const imgHeight = 4000;
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const faceWidth = maxX - minX + padding * 2;
    const faceHeight = maxY - minY + padding * 2;

    const scaleX = containerWidth / (faceWidth / imgWidth * containerWidth);
    const scaleY = containerHeight / (faceHeight / imgHeight * containerHeight);
    const newScale = Math.min(scaleX, scaleY, 3);

    // 计算平移量（让人脸居中）
    const faceCenterX = (minX + maxX) / 2 / imgWidth * containerWidth;
    const faceCenterY = (minY + maxY) / 2 / imgHeight * containerHeight;

    setScale(newScale);
    setTranslateX(containerWidth / 2 - faceCenterX * newScale);
    setTranslateY(containerHeight / 2 - faceCenterY * newScale);
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

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background flex flex-col' : 'animate-fade-in'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isFullscreen ? 'p-4 border-b' : 'mb-6'}`}>
        <div>
          <h1 className="text-2xl font-bold">预览审阅</h1>
          <p className="text-muted-foreground">{currentIndex + 1} / {task.results.length}</p>
        </div>
        <div className="flex gap-2">
          {scale > 1 && (
            <Button variant="outline" size="sm" onClick={resetZoom}>
              <RotateCcw className="w-4 h-4 mr-1" />
              重置缩放
            </Button>
          )}
          {currentResult.face_bboxes && currentResult.face_bboxes.length > 0 && (
            <Button variant="outline" size="sm" onClick={focusOnFace}>
              <Focus className="w-4 h-4 mr-1" />
              聚焦人脸
            </Button>
          )}
          <Button variant="outline" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4 mr-2" />
            {isFullscreen ? '退出全屏' : '全屏'}
          </Button>
          {!isFullscreen && (
            <Button onClick={() => navigate(`/report/${task.id}`)}>查看报告</Button>
          )}
        </div>
      </div>

      <div className={`flex gap-4 flex-1 min-h-0 ${isFullscreen ? 'px-4 pb-4' : ''}`}>
        {/* Main Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardContent className="p-4 flex-1 flex flex-col min-h-0">
              {currentResult.output_url ? (
                <div
                  ref={containerRef}
                  className={`relative bg-black rounded-lg overflow-hidden flex-1 min-h-0 ${scale > 1 ? 'cursor-grab' : 'cursor-default'}`}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                      transformOrigin: 'center center',
                      transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
                    }}
                  >
                    {currentResult.status === 'success' ? (
                      <>
                        <img
                          src={filesApi.getImageUrl(originalPath)}
                          alt="Original"
                          className="absolute inset-0 w-full h-full object-contain"
                          style={{ clipPath: showSlider ? `inset(0 ${100 - sliderPosition}% 0 0)` : undefined }}
                        />
                        <img
                          src={filesApi.getImageUrl(currentResult.output_path || '')}
                          alt="Processed"
                          className="absolute inset-0 w-full h-full object-contain"
                          style={{ clipPath: showSlider ? `inset(0 0 0 ${sliderPosition}%)` : undefined }}
                        />
                        {showSlider && (
                          <div
                            className="absolute inset-0 cursor-col-resize"
                            onClick={handleSliderMove}
                            onMouseMove={(e) => e.buttons === 1 && handleSliderMove(e)}
                          >
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
                              style={{ left: `${sliderPosition}%` }}
                            >
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                                <div className="flex gap-0.5">
                                  <ChevronLeft className="w-3 h-3" />
                                  <ChevronRight className="w-3 h-3" />
                                </div>
                              </div>
                            </div>
                            <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm">原图</div>
                            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/60 text-white text-sm">处理后</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <img
                          src={filesApi.getImageUrl(currentResult.output_path || '')}
                          alt={currentResult.filename}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm">
                          {currentResult.status === 'no_target' ? '未匹配到目标' : '处理失败'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* 缩放指示器 */}
                  {scale > 1 && (
                    <div className="absolute bottom-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm">
                      {Math.round(scale * 100)}%
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
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
                <div className="flex gap-2">
                  <Button variant={showSlider ? 'primary' : 'outline'} size="sm" onClick={() => setShowSlider(!showSlider)}>
                    对比模式
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScale(prev => Math.min(5, prev * 1.2))}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setScale(prev => Math.max(0.5, prev * 0.8))}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
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
                    <p className="font-medium">{currentResult.faces_detected}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">处理耗时</p>
                    <p className="font-medium">{currentResult.process_time_ms}ms</p>
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
              <h3 className="font-medium mb-3">缩略图导航</h3>
              <div className="grid grid-cols-2 gap-2">
                {task.results.map((result, index) => (
                  <ThumbnailItem key={result.file_id} result={result} isActive={index === currentIndex} onClick={() => setCurrentIndex(index)} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      {!isFullscreen && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">快捷键</h3>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span><kbd className="px-2 py-1 bg-muted rounded">←</kbd> 上一张</span>
              <span><kbd className="px-2 py-1 bg-muted rounded">→</kbd> 下一张</span>
              <span><kbd className="px-2 py-1 bg-muted rounded">F</kbd> 全屏</span>
              <span><kbd className="px-2 py-1 bg-muted rounded">滚轮</kbd> 缩放</span>
              <span><kbd className="px-2 py-1 bg-muted rounded">0</kbd> 重置缩放</span>
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
      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer ring-2 transition-all ${isActive ? statusColors[result.status] : 'ring-transparent hover:ring-muted-foreground/50'}`}
      onClick={onClick}
    >
      <div className="w-full h-full bg-muted flex items-center justify-center">
        {result.output_path ? (
          <img
            src={filesApi.getImageUrl(result.thumbnail_path || result.output_path)}
            alt={result.filename}
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
