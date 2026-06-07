import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Maximize2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { tasksApi } from '../services/api';
import type { Task, ImageResult } from '../types';

export function Review() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSlider, setShowSlider] = useState(true);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId) {
      loadTask(parseInt(taskId));
    }
  }, [taskId]);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task]);

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
        <Button className="mt-4" onClick={() => navigate('/batch')}>
          去批量处理
        </Button>
      </div>
    );
  }

  const currentResult = task.results[currentIndex];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">预览审阅</h1>
          <p className="text-muted-foreground">
            {currentIndex + 1} / {task.results.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4 mr-2" />
            全屏
          </Button>
          <Button onClick={() => navigate(`/report/${task.id}`)}>
            查看报告
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Preview */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              {currentResult.status === 'success' && currentResult.output_path ? (
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  {/* Original Image */}
                  <img
                    src={`/static/uploads/${currentResult.file_id}${currentResult.filename.match(/\.\w+$/)?.[0] || '.jpg'}`}
                    alt="Original"
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ clipPath: showSlider ? `inset(0 ${100 - sliderPosition}% 0 0)` : undefined }}
                  />

                  {/* Processed Image */}
                  <img
                    src={`/static/outputs/${task.id}/${currentResult.output_path.split('/').pop()}`}
                    alt="Processed"
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ clipPath: showSlider ? `inset(0 0 0 ${sliderPosition}%)` : undefined }}
                  />

                  {/* Slider */}
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

                      {/* Labels */}
                      <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-sm">
                        原图
                      </div>
                      <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/60 text-white text-sm">
                        处理后
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {currentResult.status === 'no_target'
                        ? '未检测到目标人员'
                        : '处理失败'}
                    </p>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一张
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant={showSlider ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setShowSlider(!showSlider)}
                  >
                    对比模式
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentIndex((prev) => Math.min(task.results.length - 1, prev + 1))
                  }
                  disabled={currentIndex === task.results.length - 1}
                >
                  下一张
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">文件名</p>
                  <p className="font-medium truncate">{currentResult.filename}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">状态</p>
                  <p
                    className={`font-medium ${
                      currentResult.status === 'success'
                        ? 'text-green-600'
                        : currentResult.status === 'no_target'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {currentResult.status === 'success'
                      ? '成功'
                      : currentResult.status === 'no_target'
                      ? '无目标'
                      : '失败'}
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
        </div>

        {/* Thumbnail Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-3">缩略图导航</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2 max-h-[600px] overflow-y-auto">
                {task.results.map((result, index) => (
                  <ThumbnailItem
                    key={result.file_id}
                    result={result}
                    isActive={index === currentIndex}
                    onClick={() => setCurrentIndex(index)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <h3 className="font-medium mb-2">快捷键</h3>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              <kbd className="px-2 py-1 bg-muted rounded">←</kbd> 上一张
            </span>
            <span>
              <kbd className="px-2 py-1 bg-muted rounded">→</kbd> 下一张
            </span>
            <span>
              <kbd className="px-2 py-1 bg-muted rounded">F</kbd> 全屏
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ThumbnailItem({
  result,
  isActive,
  onClick,
}: {
  result: ImageResult;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusColors = {
    success: 'ring-green-500',
    no_target: 'ring-yellow-500',
    failed: 'ring-red-500',
  };

  return (
    <div
      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer ring-2 transition-all ${
        isActive ? statusColors[result.status] : 'ring-transparent hover:ring-muted-foreground/50'
      }`}
      onClick={onClick}
    >
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <img
          src={result.thumbnail_path || ''}
          alt={result.filename}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
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
