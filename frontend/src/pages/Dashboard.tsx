import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Image, Clock, PlayCircle, Plus, Upload, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../stores/useAppStore';
import { personsApi, tasksApi } from '../services/api';
import type { Task } from '../types';

export function Dashboard() {
  const navigate = useNavigate();
  const { persons, setPersons, tasks, setTasks } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [personsRes, tasksRes] = await Promise.all([
        personsApi.list(),
        tasksApi.list(),
      ]);
      setPersons(personsRes.persons);
      setTasks(tasksRes.tasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: '已注册人员',
      value: persons.length,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      onClick: () => navigate('/persons'),
    },
    {
      title: '累计处理图片',
      value: tasks.reduce((sum, t) => sum + t.total_count, 0),
      icon: Image,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      onClick: () => navigate('/report'),
    },
    {
      title: '处理任务数',
      value: tasks.length,
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      onClick: () => navigate('/report'),
    },
    {
      title: '成功率',
      value: tasks.length > 0
        ? `${Math.round((tasks.reduce((sum, t) => sum + t.success_count, 0) / Math.max(1, tasks.reduce((sum, t) => sum + t.total_count, 0))) * 100)}%`
        : '-',
      icon: PlayCircle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  const recentTasks = tasks.slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">仪表盘</h1>
          <p className="text-muted-foreground">欢迎使用批量美颜工具</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/persons')}>
            <Plus className="w-4 h-4 mr-2" />
            注册人员
          </Button>
          <Button onClick={() => navigate('/batch')}>
            <PlayCircle className="w-4 h-4 mr-2" />
            新建批量处理
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={stat.onClick}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            最近任务
            {recentTasks.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => navigate('/report')}>
                查看全部
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Image className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">还没有处理任务</h3>
              <p className="text-muted-foreground mb-4">开始你的第一次批量处理吧</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate('/persons')}>
                  <Users className="w-4 h-4 mr-2" />
                  注册人员
                </Button>
                <Button onClick={() => navigate('/batch')}>
                  <Upload className="w-4 h-4 mr-2" />
                  导入图片
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <TaskRow key={task.id} task={task} onClick={() => navigate(`/report/${task.id}`)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <QuickAction
              icon={Users}
              title="管理目标人员"
              description="添加或编辑需要美颜的人员"
              onClick={() => navigate('/persons')}
            />
            <QuickAction
              icon={PlayCircle}
              title="开始批量处理"
              description="导入图片并开始处理"
              onClick={() => navigate('/batch')}
            />
            <QuickAction
              icon={Clock}
              title="查看历史记录"
              description="查看处理报告和结果"
              onClick={() => navigate('/report')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const [starting, setStarting] = useState(false);
  const { addToast, setTasks } = useAppStore();

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };

  const statusLabels = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setStarting(true);
      await tasksApi.start(task.id);
      addToast('任务已开始处理', 'success');
      // 刷新任务列表
      const res = await tasksApi.list();
      setTasks(res.tasks);
    } catch (error) {
      addToast('启动任务失败', 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Image className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{task.name}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(task.created_at).toLocaleString()} · {task.total_count} 张图片
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {(task.status === 'pending' || task.status === 'failed') && (
          <Button
            size="sm"
            onClick={handleStart}
            loading={starting}
            className="gap-1"
          >
            <Play className="w-3 h-3" />
            {task.status === 'failed' ? '重新处理' : '开始处理'}
          </Button>
        )}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
          {statusLabels[task.status]}
        </span>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center p-4 rounded-lg border hover:border-primary hover:bg-muted/50 cursor-pointer transition-all text-center"
      onClick={onClick}
    >
      <div className="p-3 rounded-full bg-primary/10 mb-3">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
