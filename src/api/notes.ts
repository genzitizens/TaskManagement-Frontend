import { apiRequest, DEFAULT_PAGE_SIZE } from './client';
import type { NoteCreateInput, NoteRes, Page } from '../types';

export interface ListNotesParams {
  projectId?: string;
  taskId?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export function listNotes(params: ListNotesParams = {}) {
  const { projectId, taskId, page = 0, size = DEFAULT_PAGE_SIZE, sort = 'createdAt,desc' } = params;
  return apiRequest<Page<NoteRes>>('/api/notes', {
    searchParams: { projectId, taskId, page, size, sort },
  });
}

export function createNote(payload: NoteCreateInput) {
  return apiRequest<NoteRes>('/api/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
