import { apiRequest, DEFAULT_PAGE_SIZE } from './client';
import type { Page, TaskCreateInput, TaskRes } from '../types';

export interface ListTasksParams {
  projectId?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export function listTasks(params: ListTasksParams = {}) {
  const { projectId, page = 0, size = DEFAULT_PAGE_SIZE, sort = 'endAt,asc' } = params;
  return apiRequest<Page<TaskRes>>('/api/tasks', {
    searchParams: { projectId, page, size, sort },
  });
}

export function createTask(payload: TaskCreateInput) {
  return apiRequest<TaskRes>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteTask(taskId: string) {
  return apiRequest<void>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}
