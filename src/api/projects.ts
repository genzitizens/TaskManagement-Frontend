import { apiRequest, DEFAULT_PAGE_SIZE } from './client';
import type { Page, ProjectCreateInput, ProjectRes } from '../types';

export interface ListProjectsParams {
  page?: number;
  size?: number;
  sort?: string;
}

export function listProjects(params: ListProjectsParams = {}) {
  const { page = 0, size = DEFAULT_PAGE_SIZE, sort = 'createdAt,desc' } = params;
  return apiRequest<Page<ProjectRes>>('/api/projects', {
    searchParams: { page, size, sort },
  });
}

export function createProject(payload: ProjectCreateInput) {
  return apiRequest<ProjectRes>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteProject(projectId: string) {
  return apiRequest<void>(`/api/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export function getProject(projectId: string) {
  return apiRequest<ProjectRes>(`/api/projects/${projectId}`);
}

export interface ImportProjectInput {
  sourceProjectId: string;
  newProjectName: string;
  description?: string;
  importTasks?: boolean;
  importNotes?: boolean;
  importTags?: boolean;
}

export function importProject(payload: ImportProjectInput) {
  return apiRequest<ProjectRes>('/api/projects/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
