import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Save, ArrowLeft, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { filesApi } from '../services/api';
import { useAppStore } from '../stores/useAppStore';

export function Settings() {
  const navigate = useNavigate();
  const { addToast } = useAppStore();
  const [workDir, setWorkDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await filesApi.getSettings();
      setWorkDir(res.work_dir);
    } catch {
      addToast('加载设置失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workDir.trim()) {
      addToast('工作路径不能为空', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await filesApi.updateSettings(workDir);
      setWorkDir(res.work_dir);
      addToast('设置已保存', 'success');
    } catch {
      addToast('保存设置失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
        <div>
          <h1 className="text-2xl font-bold">设置</h1>
          <p className="text-muted-foreground">配置应用参数</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            通用设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Input
              label="工作路径"
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
              placeholder="/path/to/work/directory"
            />
            <p className="text-xs text-muted-foreground mt-1">
              输入和输出目录只能在此路径下选择，确保数据安全
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              保存设置
            </Button>
            <Button variant="outline" onClick={() => navigate('/batch')}>
              <FolderOpen className="w-4 h-4 mr-2" />
              去处理
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
