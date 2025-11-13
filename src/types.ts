export interface ProjectRes {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRes {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  isActivity?: boolean;
  duration: number;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
  note?: NoteRes | null;
  color?: string;
}

export interface TagRes {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  duration: number;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
  color?: string;
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

interface ProjectBaseInput {
  name: string;
  /**
   * Some API flows still expect a `title` field. Mirror the project name to preserve compatibility.
   */
  title?: string;
  description?: string;
  startDate: string;
}

export interface ProjectCreateInput extends ProjectBaseInput {}

export interface ProjectUpdateInput extends Partial<ProjectBaseInput> {
  updatedAt?: string;
}

export interface TaskCreateInput {
  projectId: string;
  title: string;
  description?: string;
  isActivity?: boolean;
  duration: number;
  startAt: string;
  endAt: string;
  start_day: number;
  end_day: number;
  color?: string;
}

export type TaskUpdateInput = TaskCreateInput;

export interface TagCreateInput {
  projectId: string;
  title: string;
  description?: string;
  duration: number;
  startAt: string;
  endAt: string;
  start_day: number;
  end_day: number;
  isActivity?: boolean;
  color?: string;
}

export type TagUpdateInput = TagCreateInput;

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

export interface ActionRes {
  id: string;
  taskId: string;
  day: number;
  details: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionCreateInput {
  taskId: string;
  details: string;
  day: number;
}

export interface ActionUpdateInput {
  details: string;
  day: number;
}
