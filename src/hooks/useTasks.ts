import { useMutation, useQuery } from '@tanstack/react-query';
import { createTask, deleteTask, listTasks, updateTask as updateTaskApi } from '../api/tasks';
import { createNote, deleteNote, updateNote } from '../api/notes';
import type { NoteAction, TaskUpdateInput, TaskWithNoteInput } from '../types';
import { queryClient } from '../queryClient';
import { toBoolean } from '../utils/toBoolean';

export function useTasks(projectId?: string) {
  const queryKey = ['tasks', { projectId }];

  const query = useQuery({
    queryKey,
    queryFn: () => listTasks({ projectId }),
    enabled: Boolean(projectId),
    select: (data) => ({
      ...data,
      content: [...data.content]
        .map((task) => ({
          ...task,
          isActivity: task.isActivity === undefined ? undefined : toBoolean(task.isActivity),
        }))
        .sort(
          (taskA, taskB) =>
            new Date(taskA.createdAt).getTime() - new Date(taskB.createdAt).getTime(),
        ),
    }),
    onSuccess: (data) => {
      console.log('Tasks data from backend:', data);
    },
  });

  const create = useMutation({
    mutationFn: async ({ task, noteAction }: TaskWithNoteInput) => {
      const createdTask = await createTask(task);
      await handleNoteAction({ noteAction, taskId: createdTask.id });
      return createdTask;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: async ({
      taskId,
      data,
      noteAction,
    }: {
      taskId: string;
      data: TaskUpdateInput;
      noteAction: NoteAction;
    }) => {
      const updatedTask = await updateTaskApi(taskId, data);
      await handleNoteAction({ noteAction, taskId });
      return updatedTask;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    ...query,
    createTask: create.mutateAsync,
    creating: create.isPending,
    deleteTask: remove.mutateAsync,
    deleting: remove.isPending,
    updateTask: (taskId: string, data: TaskUpdateInput, noteAction: NoteAction) =>
      update.mutateAsync({ taskId, data, noteAction }),
    updating: update.isPending,
  };
}

async function handleNoteAction({
  noteAction,
  taskId,
}: {
  noteAction: NoteAction;
  taskId: string;
}) {
  switch (noteAction.type) {
    case 'none':
      return;
    case 'create':
      await createNote({ taskId, body: noteAction.body });
      return;
    case 'update':
      await updateNote(noteAction.id, { body: noteAction.body });
      return;
    case 'delete':
      await deleteNote(noteAction.id);
      return;
    default: {
      const exhaustiveCheck: never = noteAction;
      return exhaustiveCheck;
    }
  }
}
