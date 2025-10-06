import { useMutation, useQuery } from '@tanstack/react-query';
import { createTask, deleteTask, listTasks, updateTask as updateTaskApi } from '../api/tasks';
import type { TaskCreateInput, TaskUpdateInput } from '../types';
import { queryClient } from '../queryClient';

export function useTasks(projectId?: string) {
  const queryKey = ['tasks', { projectId }];

  const query = useQuery({
    queryKey,
    queryFn: () => listTasks({ projectId }),
    enabled: Boolean(projectId),
  });

  const create = useMutation({
    mutationFn: (input: TaskCreateInput) => createTask(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: TaskUpdateInput }) =>
      updateTaskApi(taskId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    ...query,
    createTask: create.mutateAsync,
    creating: create.isPending,
    deleteTask: remove.mutateAsync,
    deleting: remove.isPending,
    updateTask: (taskId: string, data: TaskUpdateInput) => update.mutateAsync({ taskId, data }),
    updating: update.isPending,
  };
}
