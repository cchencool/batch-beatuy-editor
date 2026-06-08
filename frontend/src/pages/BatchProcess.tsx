import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Play, RotateCcw, User, Settings2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Slider } from '../components/ui/Slider';
import { useAppStore } from '../stores/useAppStore';
import { filesApi, tasksApi } from '../services/api';
import type { FileInfo } from '../types';

export function BatchProcess() {
  const navigate = useNavigate();
  const { persons, uploadedFiles, addUploadedFiles, clearUploadedFiles, currentTaskConfig, setCurrentTaskConfig, resetCurrentTaskConfig, addToast } = useAppStore();
  const [processing, setProcessing] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
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
    if (currentTaskConfig.fileIds.length === 0) {
      addToast('请先上传图片', 'error');
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
        currentTaskConfig.fileIds,
        currentTaskConfig.params
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

  const canStart = currentTaskConfig.fileIds.length > 0 && currentTaskConfig.targetPersonIds.length > 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">批量处理</h1>
        <p className="text-muted-foreground">配置并执行批量美颜处理</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload */}
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
                    <span className="text-sm font-medium">
                      已导入 {uploadedFiles.length} 张图片
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearUploadedFiles();
                        setCurrentTaskConfig({ fileIds: [] });
                      }}
                    >
                      清空
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                    {uploadedFiles.map((file) => (
                      <FileThumbnail
                        key={file.id}
                        file={file}
                        onRemove={() => handleRemoveFile(file.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                  <Button variant="outline" onClick={() => navigate('/persons')}>
                    去注册人员
                  </Button>
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
                            <img
                              src={person.avatar_url}
                              alt={person.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                              {person.name.charAt(0)}
                            </div>
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
              {/* Presets */}
              <div>
                <label className="block text-sm font-medium mb-2">预设模式</label>
                <div className="flex gap-2">
                  {presetModes.map((preset) => (
                    <Button
                      key={preset.name}
                      variant={
                        currentTaskConfig.params.strength === preset.strength
                          ? 'primary'
                          : 'outline'
                      }
                      size="sm"
                      onClick={() =>
                        setCurrentTaskConfig({
                          params: {
                            strength: preset.strength,
                            edge_protection: preset.edge,
                            detail_preserve: preset.detail,
                          },
                        })
                      }
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              <Slider
                label="磨皮强度"
                value={currentTaskConfig.params.strength}
                onChange={(v) =>
                  setCurrentTaskConfig({
                    params: { ...currentTaskConfig.params, strength: v },
                  })
                }
              />

              <Slider
                label="边缘保护"
                value={currentTaskConfig.params.edge_protection}
                onChange={(v) =>
                  setCurrentTaskConfig({
                    params: { ...currentTaskConfig.params, edge_protection: v },
                  })
                }
              />

              <Slider
                label="细节保留"
                value={currentTaskConfig.params.detail_preserve}
                onChange={(v) =>
                  setCurrentTaskConfig({
                    params: { ...currentTaskConfig.params, detail_preserve: v },
                  })
                }
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Preview & Actions */}
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">任务摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">图片数量</span>
                <span className="font-medium">{currentTaskConfig.fileIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">目标人员</span>
                <span className="font-medium">{currentTaskConfig.targetPersonIds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">磨皮强度</span>
                <span className="font-medium">{currentTaskConfig.params.strength}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleStartProcess}
                loading={processing}
                disabled={!canStart}
              >
                <Play className="w-5 h-5 mr-2" />
                开始处理
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  resetCurrentTaskConfig();
                  clearUploadedFiles();
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                重置
              </Button>
            </CardContent>
          </Card>

          {/* Tips */}
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
      <img
        src={thumbnailUrl}
        alt={file.filename}
        className="w-full h-full object-cover"
      />
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
        <p className="text-[10px] text-white truncate">{file.filename}</p>
      </div>
    </div>
  );
}
