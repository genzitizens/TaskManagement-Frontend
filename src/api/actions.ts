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
  console.log('createAction API: Sending request with data:', input);
  console.log('createAction API: Request body:', JSON.stringify(input));
  
  try {
    const result = await apiRequest<ActionRes>('/actions', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    console.log('createAction API: Success response:', result);
    return result;
  } catch (error) {
    console.error('createAction API: Request failed:', error);
    
    // Add more specific error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if (error.message.includes('fetch')) {
        console.error('This is a network/fetch error - likely backend is not running or wrong URL');
      }
    }
    
    throw error;
  }
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