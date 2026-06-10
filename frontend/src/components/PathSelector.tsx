import { useState, useEffect, useRef } from 'react';
import { FolderOpen, ChevronRight, ArrowLeft, Check, History } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { filesApi } from '../services/api';

interface PathSelectorProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
  type?: 'input' | 'output';
}

interface DirItem {
  name: string;
  path: string;
}

export function PathSelector({ label, value, onChange, type = 'input' }: PathSelectorProps) {
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [dirs, setDirs] = useState<DirItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyPaths, setHistoryPaths] = useState<string[]>([]);
  const browserRef = useRef<HTMLDivElement>(null);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, [type]);

  const loadHistory = async () => {
    try {
      const res = await filesApi.getPaths();
      setHistoryPaths(type === 'input' ? res.input_paths : res.output_paths);
    } catch {}
  };

  // 加载目录内容（使用安全的 work-dirs API）
  const loadDir = async (path?: string) => {
    setLoading(true);
    try {
      const res = await filesApi.listWorkDirs(path);
      setCurrentPath(res.current);
      setParentPath(res.parent);
      setDirs(res.dirs);
    } catch {
      setDirs([]);
    } finally {
      setLoading(false);
    }
  };

  // 打开浏览器
  const handleOpenBrowser = () => {
    loadDir(value || undefined);
    setShowBrowser(true);
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (browserRef.current && !browserRef.current.contains(e.target as Node)) {
        setShowBrowser(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 选择目录并保存到历史
  const handleSelectCurrent = async () => {
    onChange(currentPath);
    setShowBrowser(false);
    localStorage.setItem(`beauty-last-${type}-path`, currentPath);
    try {
      const res = await filesApi.savePath(currentPath, type);
      setHistoryPaths(res.paths);
    } catch {}
  };

  // 从历史中选择
  const handleSelectHistory = (path: string) => {
    onChange(path);
    setShowBrowser(false);
    localStorage.setItem(`beauty-last-${type}-path`, path);
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="relative" ref={browserRef}>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="选择目录..."
          />
        </div>
        <Button
          variant="outline"
          className="mt-6"
          onClick={handleOpenBrowser}
        >
          <FolderOpen className="w-4 h-4" />
        </Button>
      </div>

      {showBrowser && (
        <div className="absolute z-50 top-full mt-1 w-full bg-background border rounded-lg shadow-lg overflow-hidden">
          {/* 面包屑导航 */}
          <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/50 text-sm overflow-x-auto">
            {parentPath !== null && (
              <button
                onClick={() => loadDir(parentPath)}
                className="p-1 hover:bg-muted rounded flex-shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => loadDir()}
              className="hover:text-primary flex-shrink-0 px-1"
            >
              工作目录
            </button>
            {pathParts.map((part, i) => {
              const fullPath = '/' + pathParts.slice(0, i + 1).join('/');
              return (
                <span key={i} className="flex items-center flex-shrink-0">
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <button
                    onClick={() => loadDir(fullPath)}
                    className="hover:text-primary px-1"
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </div>

          {/* 选择按钮 */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{currentPath}</span>
            <Button size="sm" onClick={handleSelectCurrent}>
              <Check className="w-3 h-3 mr-1" />
              选择此目录
            </Button>
          </div>

          {/* 历史路径 */}
          {historyPaths.length > 0 && (
            <div className="border-b">
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <History className="w-3 h-3" />
                最近使用
              </div>
              {historyPaths.slice(0, 5).map((path) => (
                <button
                  key={path}
                  onClick={() => handleSelectHistory(path)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs truncate">{path}</span>
                </button>
              ))}
            </div>
          )}

          {/* 目录列表 */}
          <div className="overflow-y-auto max-h-48">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">加载中...</div>
            ) : dirs.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">此目录下没有子文件夹</div>
            ) : (
              dirs.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => loadDir(dir.path)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                >
                  <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{dir.name}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
