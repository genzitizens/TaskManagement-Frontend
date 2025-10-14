export interface ProjectRes {
  id: string;
  name: string;
  description?: string;
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
  note?: NoteRes | null;
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
  /**
   * Some API flows still expect a `title` field. Mirror the project name to preserve compatibility.
   */
  title?: string;
  description?: string;
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

export interface NoteUpdateInput {
  body: string;
}

export type NoteAction =
  | { type: 'none' }
  | { type: 'create'; body: string }
  | { type: 'update'; id: string; body: string }
  | { type: 'delete'; id: string };

export interface TaskWithNoteInput {
  task: TaskCreateInput;
  noteAction: NoteAction;
}
