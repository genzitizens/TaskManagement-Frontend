export interface ProjectRes {
  id: string;
  name: string;
  description?: string;
  startAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRes {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  isActivity?: boolean;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteRes {
  id: string;
  projectId?: string;
  taskId?: string;
  body: string;
  createdAt: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  startAt: string;
}

export interface ProjectUpdateInput extends ProjectCreateInput {
  updatedAt?: string;
}

export interface ProjectUpdateInput extends ProjectCreateInput {
  updatedAt?: string;
}

export interface TaskCreateInput {
  projectId: string;
  title: string;
  description?: string;
  isActivity?: boolean;
  endAt: string;
}

export type TaskUpdateInput = TaskCreateInput;

export interface NoteCreateInput {
  projectId?: string;
  taskId?: string;
  body: string;
}
