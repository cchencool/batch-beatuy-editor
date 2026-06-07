import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person, Task, FileInfo, BeautifyParams } from '../types';

interface AppState {
  // 人员
  persons: Person[];
  setPersons: (persons: Person[]) => void;
  addPerson: (person: Person) => void;
  updatePerson: (id: number, updates: Partial<Person>) => void;
  removePerson: (id: number) => void;

  // 文件
  uploadedFiles: FileInfo[];
  setUploadedFiles: (files: FileInfo[]) => void;
  addUploadedFiles: (files: FileInfo[]) => void;
  removeUploadedFile: (id: string) => void;
  clearUploadedFiles: () => void;

  // 任务
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;

  // 当前批量处理配置
  currentTaskConfig: {
    name: string;
    targetPersonIds: number[];
    fileIds: string[];
    params: BeautifyParams;
  };
  setCurrentTaskConfig: (config: Partial<AppState['currentTaskConfig']>) => void;
  resetCurrentTaskConfig: () => void;

  // UI状态
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: AppState['theme']) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Toast消息
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // 人员
      persons: [],
      setPersons: (persons) => set({ persons }),
      addPerson: (person) => set((state) => ({ persons: [...state.persons, person] })),
      updatePerson: (id, updates) =>
        set((state) => ({
          persons: state.persons.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      removePerson: (id) =>
        set((state) => ({ persons: state.persons.filter((p) => p.id !== id) })),

      // 文件
      uploadedFiles: [],
      setUploadedFiles: (files) => set({ uploadedFiles: files }),
      addUploadedFiles: (files) =>
        set((state) => ({
          uploadedFiles: [...state.uploadedFiles, ...files],
        })),
      removeUploadedFile: (id) =>
        set((state) => ({
          uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id),
        })),
      clearUploadedFiles: () => set({ uploadedFiles: [] }),

      // 任务
      tasks: [],
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      // 当前任务配置
      currentTaskConfig: {
        name: '',
        targetPersonIds: [],
        fileIds: [],
        params: {
          strength: 50,
          edge_protection: 70,
          detail_preserve: 60,
        },
      },
      setCurrentTaskConfig: (config) =>
        set((state) => ({
          currentTaskConfig: { ...state.currentTaskConfig, ...config },
        })),
      resetCurrentTaskConfig: () =>
        set({
          currentTaskConfig: {
            name: '',
            targetPersonIds: [],
            fileIds: [],
            params: {
              strength: 50,
              edge_protection: 70,
              detail_preserve: 60,
            },
          },
        }),

      // UI状态
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Toast
      toasts: [],
      addToast: (message, type) => {
        const id = Date.now().toString();
        set((state) => ({
          toasts: [...state.toasts, { id, message, type }],
        }));
        // 3秒后自动移除
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
        }, 3000);
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'beauty-app-storage',
      partialize: (state) => ({
        theme: state.theme,
        currentTaskConfig: state.currentTaskConfig,
      }),
    }
  )
);
