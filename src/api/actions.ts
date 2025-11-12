import { apiRequest } from './client';
import type { ActionRes, ActionCreateInput, ActionUpdateInput, Page } from '../types';

interface ListActionsParams {
  taskId?: string;
  size?: number;
  page?: number;
}

export async function listActions(params: ListActionsParams = {}): Promise<Page<ActionRes>> {
  const searchParams: Record<string, string | number | boolean | undefined | null> = {};
  
  if (params.taskId) {
    searchParams.taskId = params.taskId;
  }
  if (params.size !== undefined) {
    searchParams.size = params.size;
  }
  if (params.page !== undefined) {
    searchParams.page = params.page;
  }

  return apiRequest<Page<ActionRes>>('/actions', {
    searchParams: searchParams
  });
}

export async function getAction(id: string): Promise<ActionRes> {
  return apiRequest<ActionRes>(`/actions/${id}`);
}

export async function createAction(input: ActionCreateInput): Promise<ActionRes> {
  return apiRequest<ActionRes>('/actions', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateAction(id: string, input: ActionUpdateInput): Promise<ActionRes> {
  return apiRequest<ActionRes>(`/actions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export async function deleteAction(id: string): Promise<void> {
  return apiRequest<void>(`/actions/${id}`, {
    method: 'DELETE'
  });
}