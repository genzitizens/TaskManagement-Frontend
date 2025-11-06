import { apiRequest, DEFAULT_PAGE_SIZE } from './client';
import type { Page, TagCreateInput, TagRes, TagUpdateInput } from '../types';

export interface ListTagsParams {
  projectId?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export function listTags(params: ListTagsParams = {}) {
  const { projectId, page = 0, size = DEFAULT_PAGE_SIZE, sort = 'createdAt,asc' } = params;
  return apiRequest<Page<TagRes>>('/api/tags', {
    searchParams: { projectId, page, size, sort },
  });
}

export function createTag(payload: TagCreateInput) {
  return apiRequest<TagRes>('/api/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTag(tagId: string, payload: TagUpdateInput) {
  return apiRequest<TagRes>(`/api/tags/${tagId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteTag(tagId: string) {
  return apiRequest<void>(`/api/tags/${tagId}`, {
    method: 'DELETE',
  });
}
