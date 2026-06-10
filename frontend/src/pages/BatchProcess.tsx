import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Play, RotateCcw, User, Settings2, FolderOpen, Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Slider } from '../components/ui/Slider';
import { PathSelector } from '../components/PathSelector';
import { useAppStore } from '../stores/useAppStore';
import { filesApi, tasksApi, personsApi } from '../services/api';
import type { FileInfo } from '../types';

interface DirFile {
  id: string;
  name: string;
  path: string;
  size: number;
  extension: string;
}

export function BatchProcess() {
  const navigate = useNavigate();
  const { persons, setPersons, uploadedFiles, addUploadedFiles, clearUploadedFiles, currentTaskConfig, setCurrentTaskConfig, resetCurrentTaskConfig, addToast } = useAppStore();
  const [processing, setProcessing] = useState(false);
  const [dirFiles, setDirFiles] = useState<DirFile[]>([]);
  const [selectedDirFiles, setSelectedDirFiles] = useState<string[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);

  // 加载人员列表
  useEffect(() => {
    if (persons.length === 0) {
      personsApi.list().then(res => setPersons(res.persons)).catch(() => {});
    }
  }, []);

  // 输入目录变化时扫描文件
  useEffect(() => {
    if (currentTaskConfig.inputDir) {
      scanInputDir(currentTaskConfig.inputDir);
    } else {
      setDirFiles([]);
      setSelectedDirFiles([]);
    }
  }, [currentTaskConfig.inputDir]);

  const scanInputDir = async (path: string) => {
    setLoadingDir(true);
    try {
      // 生成缩略图
      await filesApi.generateThumbnails(path);
      // 扫描文件
      const res = await filesApi.scanDir(path);
      setDirFiles(res.files);
      // 默认全选
      setSelectedDirFiles(res.files.map(f => f.path));
    } catch {
      setDirFiles([]);
      setSelectedDirFiles([]);
    } finally {
      setLoadingDir(false);
    }
  };

  const toggleDirFile = (filePath: string) => {
    setSelectedDirFiles(prev =>
      prev.includes(filePath)
        ? prev.filter(p => p !== filePath)
        : [...prev, filePath]
    );
  };

  const toggleAllDirFiles = () => {
    if (selectedDirFiles.length === dirFiles.length) {
      setSelectedDirFiles([]);
    } else {
      setSelectedDirFiles(dirFiles.map(f => f.path));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    onDrop: async (acceptedFiles) => {
      try {
        const res = await filesApi.upload(acceptedFiles);
        addUploadedFiles(res.files);
        setCurrentTaskConfig({
          fileIds: [...currentTaskConfig.fileIds, ...res.files.map((f) => f.id)],
        });
        addToast(`已上传 ${res.files.length} 张图片`, 'success');
      } catch (error) {
        addToast('上传失败', 'error');
      }
    },
  });

  const handleRemoveFile = async (fileId: string) => {
    try {
      await filesApi.delete(fileId);
      clearUploadedFiles();
      const res = await filesApi.list();
      addUploadedFiles(res.files);
      setCurrentTaskConfig({
        fileIds: currentTaskConfig.fileIds.filter((id) => id !== fileId),
      });
    } catch (error) {
      addToast('删除失败', 'error');
    }
  };

  const handleStartProcess = async () => {
    const useDirFiles = currentTaskConfig.inputDir && selectedDirFiles.length > 0;
    const useUploaded = currentTaskConfig.fileIds.length > 0;

    if (!useDirFiles && !useUploaded) {
      addToast('请先上传图片或选择输入目录', 'error');
      return;
    }
    if (currentTaskConfig.targetPersonIds.length === 0) {
      addToast('请选择目标人员', 'error');
      return;
    }

    try {
      setProcessing(true);
      const taskName = currentTaskConfig.name || `批量处理_${new Date().toLocaleString()}`;
      const task = await tasksApi.create(
        taskName,
        currentTaskConfig.targetPersonIds,
        useUploaded ? currentTaskConfig.fileIds : [],
        currentTaskConfig.params,
        currentTaskConfig.inputDir || undefined,
        currentTaskConfig.outputDir || undefined,
        useDirFiles ? selectedDirFiles : undefined
      );
      addToast('任务已创建，开始处理', 'success');
      resetCurrentTaskConfig();
      navigate(`/report/${task.id}`);
    } catch (error) {
      addToast('创建任务失败', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const togglePerson = (personId: number) => {
    const ids = currentTaskConfig.targetPersonIds;
    if (ids.includes(personId)) {
      setCurrentTaskConfig({ targetPersonIds: ids.filter((id) => id !== personId) });
    } else {
      setCurrentTaskConfig({ targetPersonIds: [...ids, personId] });
    }
  };

  const presetModes = [
    { name: '轻度', strength: 30, edge: 90, detail: 80 },
    { name: '中度', strength: 55, edge: 75, detail: 60 },
    { name: '重度', strength: 80, edge: 60, detail: 40 },
  ];

  const totalFileCount = currentTaskConfig.inputDir ? selectedDirFiles.length : currentTaskConfig.fileIds.length;
  const canStart = totalFileCount > 0 && currentTaskConfig.targetPersonIds.length > 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">批量处理</h1>
        <p className="text-muted-foreground">配置并执行批量美颜处理</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Path Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                目录设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PathSelector
                label="输入目录（选择后可直接勾选文件）"
                value={currentTaskConfig.inputDir}
                onChange={(v) => setCurrentTaskConfig({ inputDir: v })}
                type="input"
              />
              <PathSelector
                label="输出目录（可选，留空则自动创建）"
                value={currentTaskConfig.outputDir}
                onChange={(v) => setCurrentTaskConfig({ outputDir: v })}
                type="output"
              />
            </CardContent>
          </Card>

          {/* Directory Files - when input dir is set */}
          {currentTaskConfig.inputDir && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    选择文件
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {selectedDirFiles.length} / {dirFiles.length} 已选
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDir ? (
                  <div className="text-center py-8 text-muted-foreground">加载中...</div>
                ) : dirFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">该目录下没有图片文件</div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={toggleAllDirFiles}
                        className="text-sm text-primary hover:underline"
                      >
                        {selectedDirFiles.length === dirFiles.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                      {dirFiles.map((file) => {
                        const isSelected = selectedDirFiles.includes(file.path);
                        const thumbUrl = filesApi.getThumbUrl(file.path);
                        return (
                          <button
                            key={file.path}
                            onClick={() => toggleDirFile(file.path)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              isSelected
                                ? 'border-primary ring-2 ring-primary/20'
                                : 'border-transparent hover:border-muted-foreground/30'
                            }`}
                          >
                            <img
                              src={thumbUrl}
                              alt={file.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                              <p className="text-[10px] text-white truncate">{file.name}</p>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* File Upload - fallback when no input dir */}
          {!currentTaskConfig.inputDir && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  导入图片
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-lg font-medium mb-1">
                    {isDragActive ? '松开以上传' : '拖拽图片到此处'}
                  </p>
                  <p className="text-sm text-muted-foreground">或点击选择文件，支持 JPG、PNG、WebP</p>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">已导入 {uploadedFiles.length} 张图片</span>
                      <Button variant="ghost" size="sm" onClick={() => { clearUploadedFiles(); setCurrentTaskConfig({ fileIds: [] }); }}>
                        清空
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                      {uploadedFiles.map((file) => (
                        <FileThumbnail key={file.id} file={file} onRemove={() => handleRemoveFile(file.id)} />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Target Persons */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                选择目标人员
              </CardTitle>
            </CardHeader>
            <CardContent>
              {persons.length === 0 ? (
                <div className="text-center py-6">
                  <User className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">还没有注册人员</p>
                  <Button variant="outline" onClick={() => navigate('/persons')}>去注册人员</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {persons.map((person) => {
                    const isSelected = currentTaskConfig.targetPersonIds.includes(person.id);
                    return (
                      <button
                        key={person.id}
                        onClick={() => togglePerson(person.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-input'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-muted overflow-hidden">
                          {person.avatar_url ? (
                            <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium">{person.name.charAt(0)}</div>
                          )}
                        </div>
                        <span className="text-sm font-medium">{person.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                美颜参数
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">预设模式</label>
                <div className="flex gap-2">
                  {presetModes.map((preset) => (
                    <Button
                      key={preset.name}
                      variant={currentTaskConfig.params.strength === preset.strength ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentTaskConfig({ params: { strength: preset.strength, edge_protection: preset.edge, detail_preserve: preset.detail } })}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
              <Slider label="磨皮强度" value={currentTaskConfig.params.strength} onChange={(v) => setCurrentTaskConfig({ params: { ...currentTaskConfig.params, strength: v } })} />
              <Slider label="边缘保护" value={currentTaskConfig.params.edge_protection} onChange={(v) => setCurrentTaskConfig({ params: { ...currentTaskConfig.params, edge_protection: v } })} />
              <Slider label="细节保留" value={currentTaskConfig.params.detail_preserve} onChange={(v) => setCurrentTaskConfig({ params: { ...currentTaskConfig.params, detail_preserve: v } })} />
            </CardContent>
          </Card>
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">任务摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">图片数量</span>
                <span className="font-medium">{totalFileCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">目标人员</span>
                <span className="font-medium">{currentTaskConfig.targetPersonIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">磨皮强度</span>
                <span className="font-medium">{currentTaskConfig.params.strength}%</span>
              </div>
              {currentTaskConfig.inputDir && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">输入目录</span>
                  <span className="font-medium text-xs truncate max-w-[150px]">{currentTaskConfig.inputDir}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <Button className="w-full" size="lg" onClick={handleStartProcess} loading={processing} disabled={!canStart}>
                <Play className="w-5 h-5 mr-2" />
                开始处理
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { resetCurrentTaskConfig(); clearUploadedFiles(); }}>
                <RotateCcw className="w-4 h-4 mr-2" />
                重置
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-medium mb-2">温馨提示</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 建议每人提供 2-3 张不同角度的参考照片</li>
                <li>• 磨皮强度建议从"中度"开始尝试</li>
                <li>• 处理过程中可以暂停或取消</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FileThumbnail({ file, onRemove }: { file: FileInfo; onRemove: () => void }) {
  const thumbnailUrl = file.thumbnail_url || file.original_url || `/static/uploads/${file.id}${file.extension}`;
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden group bg-muted">
      <img src={thumbnailUrl} alt={file.filename} className="w-full h-full object-cover" />
      <button onClick={onRemove} className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="w-3 h-3" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
        <p className="text-[10px] text-white truncate">{file.filename}</p>
      </div>
    </div>
  );
}
