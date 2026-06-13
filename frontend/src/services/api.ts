import axios from 'axios';
import type {
  Person,
  PersonListResponse,
  Task,
  TaskListResponse,
  TaskProgress,
  FileInfo,
  FileUploadResponse,
  MessageResponse,
  BeautifyParams
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 人员管理 API
export const personsApi = {
  list: async (search?: string): Promise<PersonListResponse> => {
    const params = search ? { search } : {};
    const { data } = await api.get('/persons/', { params });
    return data;
  },

  get: async (id: number): Promise<Person> => {
    const { data } = await api.get(`/persons/${id}`);
    return data;
  },

  create: async (name: string, note: string | undefined, photos: File[]): Promise<Person> => {
    const formData = new FormData();
    formData.append('name', name);
    if (note) formData.append('note', note);
    photos.forEach(photo => formData.append('photos', photo));

    const { data } = await api.post('/persons/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  update: async (id: number, updates: { name?: string; note?: string }): Promise<Person> => {
    const { data } = await api.put(`/persons/${id}`, updates);
    return data;
  },

  delete: async (id: number): Promise<MessageResponse> => {
    const { data } = await api.delete(`/persons/${id}`);
    return data;
  },

  addPhotos: async (id: number, photos: File[]): Promise<Person> => {
    const formData = new FormData();
    photos.forEach(photo => formData.append('photos', photo));

    const { data } = await api.post(`/persons/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  deletePhoto: async (personId: number, photoIndex: number): Promise<Person> => {
    const { data } = await api.delete(`/persons/${personId}/photos/${photoIndex}`);
    return data;
  },
};

// 文件管理 API
export const filesApi = {
  upload: async (files: File[]): Promise<FileUploadResponse> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const { data } = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  list: async (): Promise<FileUploadResponse> => {
    const { data } = await api.get('/files/list');
    return data;
  },

  get: async (fileId: string): Promise<FileInfo> => {
    const { data } = await api.get(`/files/${fileId}`);
    return data;
  },

  delete: async (fileId: string): Promise<MessageResponse> => {
    const { data } = await api.delete(`/files/${fileId}`);
    return data;
  },

  clearAll: async (): Promise<MessageResponse> => {
    const { data } = await api.delete('/files/');
    return data;
  },

  // 路径管理
  getPaths: async (): Promise<{ default_input: string; default_output: string; input_paths: string[]; output_paths: string[] }> => {
    const { data } = await api.get('/files/paths');
    return data;
  },

  listDirs: async (path: string): Promise<{ current: string; parent: string | null; dirs: { name: string; path: string }[] }> => {
    const { data } = await api.get('/files/list-dirs', { params: { path } });
    return data;
  },

  scanDir: async (path: string): Promise<{ path: string; exists: boolean; is_dir: boolean; files: { id: string; name: string; path: string; size: number; extension: string }[] }> => {
    const { data } = await api.get('/files/scan', { params: { path } });
    return data;
  },

  // 应用设置
  getSettings: async (): Promise<{ work_dir: string; enable_optimization: boolean }> => {
    const { data } = await api.get('/files/settings');
    return data;
  },

  updateSettings: async (workDir?: string, enableOptimization?: boolean): Promise<{ success: boolean; work_dir: string; enable_optimization: boolean }> => {
    const body: Record<string, unknown> = {};
    if (workDir !== undefined) body.work_dir = workDir;
    if (enableOptimization !== undefined) body.enable_optimization = enableOptimization;
    const { data } = await api.post('/files/settings', body);
    return data;
  },

  // 安全目录浏览（限制在 root 内）
  listWorkDirs: async (path?: string, root?: string): Promise<{ current: string; parent: string | null; dirs: { name: string; path: string }[] }> => {
    const params: Record<string, string> = {};
    if (path) params.path = path;
    if (root) params.root = root;
    const { data } = await api.get('/files/work-dirs', { params });
    return data;
  },

  // 缩略图生成
  generateThumbnails: async (path: string): Promise<{ success: boolean; count: number; thumb_dir: string }> => {
    const { data } = await api.post('/files/thumbnails', { path });
    return data;
  },

  // 获取缩略图
  getThumbUrl: (path: string): string => {
    return `/api/files/thumb?path=${encodeURIComponent(path)}`;
  },

  // 获取原始图片
  getImageUrl: (path: string): string => {
    return `/api/files/image?path=${encodeURIComponent(path)}`;
  },

  savePath: async (path: string, type: 'input' | 'output'): Promise<{ success: boolean; paths: string[] }> => {
    const { data } = await api.post('/files/paths', { path, type });
    return data;
  },

  deletePath: async (path: string, type: 'input' | 'output'): Promise<{ success: boolean; paths: string[] }> => {
    const { data } = await api.delete('/files/paths', { data: { path, type } });
    return data;
  },

  reorderPaths: async (paths: string[], type: 'input' | 'output'): Promise<{ success: boolean; paths: string[] }> => {
    const { data } = await api.put('/files/paths/reorder', { paths, type });
    return data;
  },
};

// 任务管理 API
export const tasksApi = {
  list: async (status?: string): Promise<TaskListResponse> => {
    const params = status ? { status } : {};
    const { data } = await api.get('/tasks/', { params });
    return data;
  },

  get: async (id: number): Promise<Task> => {
    const { data } = await api.get(`/tasks/${id}`);
    return data;
  },

  create: async (
    name: string,
    targetPersonIds: number[],
    fileIds: string[],
    params: BeautifyParams,
    inputDir?: string,
    outputDir?: string,
    filePaths?: string[]
  ): Promise<Task> => {
    const { data } = await api.post('/tasks/', {
      name,
      target_person_ids: targetPersonIds,
      file_ids: fileIds,
      file_paths: filePaths || [],
      params,
      input_dir: inputDir || undefined,
      output_dir: outputDir || undefined,
    });
    return data;
  },

  start: async (id: number): Promise<MessageResponse> => {
    const { data } = await api.post(`/tasks/${id}/start`);
    return data;
  },

  pause: async (id: number): Promise<MessageResponse> => {
    const { data } = await api.post(`/tasks/${id}/pause`);
    return data;
  },

  cancel: async (id: number): Promise<MessageResponse> => {
    const { data } = await api.post(`/tasks/${id}/cancel`);
    return data;
  },

  delete: async (id: number): Promise<MessageResponse> => {
    const { data } = await api.delete(`/tasks/${id}`);
    return data;
  },

  getProgress: async (id: number): Promise<TaskProgress> => {
    const { data } = await api.get(`/tasks/${id}/progress`);
    return data;
  },

  download: async (id: number): Promise<Blob> => {
    const { data } = await api.get(`/tasks/${id}/download`, {
      responseType: 'blob',
    });
    return data;
  },
};

export default api;
