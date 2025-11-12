import { useMutation, useQuery } from '@tanstack/react-query';
import { createAction, deleteAction, listActions, updateAction as updateActionApi } from '../api/actions';
import type { ActionRes, ActionCreateInput, ActionUpdateInput, Page } from '../types';
import { queryClient } from '../queryClient';

export function useActions(taskId?: string) {
  const queryKey = ['actions', { taskId }];

  const query = useQuery({
    queryKey,
    queryFn: () => listActions({ taskId }),
    enabled: Boolean(taskId),
    select: (data: Page<ActionRes>): Page<ActionRes> => ({
      ...data,
      content: [...data.content].sort(
        (actionA, actionB) =>
          new Date(actionA.createdAt).getTime() - new Date(actionB.createdAt).getTime(),
      ),
    }),
  });

  const create = useMutation({
    mutationFn: createAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActionUpdateInput }) =>
      updateActionApi(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  const deleteAction_ = useMutation({
    mutationFn: deleteAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  return {
    ...query,
    createAction: create.mutateAsync,
    creating: create.isPending,
    updateAction: update.mutateAsync,
    updating: update.isPending,
    deleteAction: deleteAction_.mutateAsync,
    deleting: deleteAction_.isPending,
  };
}

// Hook to get all actions for multiple tasks (used for timeline display)
export function useAllActions(taskIds: string[]) {
  const queryKey = ['actions', 'all', { taskIds: taskIds.sort() }];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (taskIds.length === 0) {
        return { content: [], totalElements: 0, totalPages: 0, size: 0, number: 0, numberOfElements: 0 };
      }
      
      // Fetch actions for all tasks
      const allActions: ActionRes[] = [];
      for (const taskId of taskIds) {
        const result = await listActions({ taskId, size: 1000 });
        allActions.push(...result.content);
      }
      
      return {
        content: allActions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        totalElements: allActions.length,
        totalPages: 1,
        size: allActions.length,
        number: 0,
        numberOfElements: allActions.length,
      };
    },
    enabled: taskIds.length > 0,
  });

  return query;
}