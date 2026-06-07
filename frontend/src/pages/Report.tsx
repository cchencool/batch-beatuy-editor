import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  Eye,
  FileText,
  PieChart,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { tasksApi } from '../services/api';
import { useAppStore } from '../stores/useAppStore';
import type { Task, TaskProgress } from '../types';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

export function Report() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { tasks, setTasks, addToast } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [taskId]);

  useEffect(() => {
    // Poll progress if task is processing
    if (selectedTask?.status === 'processing') {
      const interval = setInterval(async () => {
        try {
          const p = await tasksApi.getProgress(selectedTask.id);
          setProgress(p);
          if (p.status !== 'processing') {
            clearInterval(interval);
            // Reload task
            const updated = await tasksApi.get(selectedTask.id);
            setSelectedTask(updated);
            setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
          }
        } catch (error) {
          console.error('Failed to get progress:', error);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedTask?.status, selectedTask?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (taskId) {
        const task = await tasksApi.get(parseInt(taskId));
        setSelectedTask(task);
      } else if (tasks.length > 0) {
        setSelectedTask(tasks[0]);
      }
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedTask) return;
    try {
      const blob = await tasksApi.download(selectedTask.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task_${selectedTask.id}_results.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast('下载已开始', 'success');
    } catch (error) {
      addToast('下载失败', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!selectedTask) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-medium mb-2">还没有处理报告</h2>
        <p className="text-muted-foreground mb-4">完成一次批量处理后，报告将显示在这里</p>
        <Button onClick={() => navigate('/batch')}>去批量处理</Button>
      </div>
    );
  }

  const chartData = [
    { name: '成功', value: selectedTask.success_count, color: '#22c55e' },
    { name: '未检测到目标', value: selectedTask.no_target_count, color: '#eab308' },
    { name: '失败', value: selectedTask.failed_count, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const successRate = selectedTask.total_count > 0
    ? Math.round((selectedTask.success_count / selectedTask.total_count) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">处理报告</h1>
          <p className="text-muted-foreground">{selectedTask.name}</p>
        </div>
        <div className="flex gap-2">
          {selectedTask.status === 'completed' && (
            <>
              <Button variant="outline" onClick={() => navigate(`/review/${selectedTask.id}`)}>
                <Eye className="w-4 h-4 mr-2" />
                审阅
              </Button>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                下载结果
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Task Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            任务摘要
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">创建时间</p>
              <p className="font-medium">{new Date(selectedTask.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">状态</p>
              <StatusBadge status={selectedTask.status} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">图片总数</p>
              <p className="font-medium">{selectedTask.total_count}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">成功率</p>
              <p className="font-medium">{successRate}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          {selectedTask.status === 'processing' && progress && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>处理进度</span>
                <span>
                  {progress.processed_count} / {progress.total_count}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.progress_percent}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              处理统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-4">
              <p className="text-3xl font-bold">{successRate}%</p>
              <p className="text-sm text-muted-foreground">成功率</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">详细统计</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatItem
              icon={CheckCircle}
              label="处理成功"
              value={selectedTask.success_count}
              color="text-green-500"
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
            <StatItem
              icon={AlertTriangle}
              label="未检测到目标"
              value={selectedTask.no_target_count}
              color="text-yellow-500"
              bgColor="bg-yellow-50 dark:bg-yellow-900/20"
            />
            <StatItem
              icon={XCircle}
              label="处理失败"
              value={selectedTask.failed_count}
              color="text-red-500"
              bgColor="bg-red-50 dark:bg-red-900/20"
            />
          </CardContent>
        </Card>
      </div>

      {/* Results List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">处理结果详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">文件名</th>
                  <th className="text-center py-3 px-2 font-medium">状态</th>
                  <th className="text-center py-3 px-2 font-medium">人脸数</th>
                  <th className="text-center py-3 px-2 font-medium">匹配数</th>
                  <th className="text-right py-3 px-2 font-medium">耗时</th>
                </tr>
              </thead>
              <tbody>
                {selectedTask.results.map((result) => (
                  <tr key={result.file_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <span className="truncate max-w-[200px] block">{result.filename}</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <ResultStatusBadge status={result.status} />
                    </td>
                    <td className="py-3 px-2 text-center">{result.faces_detected}</td>
                    <td className="py-3 px-2 text-center">{result.targets_matched}</td>
                    <td className="py-3 px-2 text-right">{result.process_time_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Task List (if no specific task selected) */}
      {!taskId && tasks.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">所有任务</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/report/${task.id}`)}
                >
                  <div>
                    <p className="font-medium">{task.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(task.created_at).toLocaleString()} · {task.total_count} 张图片
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    processing: { label: '处理中', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    completed: { label: '已完成', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    failed: { label: '失败', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  };

  const { label, color } = config[status as keyof typeof config] || config.pending;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function ResultStatusBadge({ status }: { status: string }) {
  const config = {
    success: { label: '成功', color: 'text-green-600' },
    no_target: { label: '无目标', color: 'text-yellow-600' },
    failed: { label: '失败', color: 'text-red-600' },
  };

  const { label, color } = config[status as keyof typeof config] || config.failed;

  return <span className={`font-medium ${color}`}>{label}</span>;
}

function StatItem({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}
