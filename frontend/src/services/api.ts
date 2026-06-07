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
    params: BeautifyParams
  ): Promise<Task> => {
    const { data } = await api.post('/tasks/', {
      name,
      target_person_ids: targetPersonIds,
      file_ids: fileIds,
      params,
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
