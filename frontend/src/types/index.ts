// 人员相关类型
export interface Person {
  id: number;
  name: string;
  note?: string;
  avatar_path?: string;
  avatar_url?: string;
  reference_photos: string[];
  photo_urls?: string[];
  is_active: boolean;
  process_count: number;
  last_process_time?: string;
  created_at: string;
  updated_at: string;
}

// 文件相关类型
export interface FileInfo {
  id: string;
  filename: string;
  original_path: string;
  original_url?: string;
  size: number;
  extension: string;
  thumbnail_path?: string;
  thumbnail_url?: string;
}

// 任务状态
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// 美颜参数
export interface BeautifyParams {
  strength: number;
  edge_protection: number;
  detail_preserve: number;
}

// 图片处理结果
export interface ImageResult {
  file_id: string;
  filename: string;
  status: 'success' | 'failed' | 'no_target';
  faces_detected: number;
  targets_matched: number;
  output_path?: string;
  output_url?: string;
  thumbnail_path?: string;
  thumbnail_url?: string;
  process_time_ms: number;
  error_message?: string;
}

// 任务
export interface Task {
  id: number;
  name: string;
  status: TaskStatus;
  target_person_ids: number[];
  beautify_strength: number;
  edge_protection: number;
  detail_preserve: number;
  total_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  no_target_count: number;
  results: ImageResult[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
  error_message?: string;
}

// 任务进度
export interface TaskProgress {
  task_id: number;
  status: TaskStatus;
  total_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  no_target_count: number;
  current_file?: string;
  progress_percent: number;
}

// API响应类型
export interface MessageResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface PersonListResponse {
  persons: Person[];
  total: number;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
}

export interface FileUploadResponse {
  files: FileInfo[];
  total: number;
}
