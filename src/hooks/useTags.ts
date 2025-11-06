import { useMutation, useQuery } from '@tanstack/react-query';
import { createTag, deleteTag as deleteTagApi, listTags, updateTag as updateTagApi } from '../api/tags';
import type { Page, TagCreateInput, TagRes, TagUpdateInput } from '../types';
import { queryClient } from '../queryClient';

export function useTags(projectId?: string) {
  const queryKey = ['tags', { projectId }];

  const query = useQuery({
    queryKey,
    queryFn: () => listTags({ projectId }),
    enabled: Boolean(projectId),
    select: (data: Page<TagRes>): Page<TagRes> => ({
      ...data,
      content: [...data.content].sort(
        (tagA, tagB) =>
          new Date(tagA.createdAt).getTime() - new Date(tagB.createdAt).getTime(),
      ),
    }),
  });

  const create = useMutation({
    mutationFn: (input: TagCreateInput) => createTag(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (tagId: string) => deleteTagApi(tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ tagId, data }: { tagId: string; data: TagUpdateInput }) =>
      updateTagApi(tagId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    ...query,
    createTag: create.mutateAsync,
    creating: create.isPending,
    deleteTag: remove.mutateAsync,
    deleting: remove.isPending,
    updateTag: (tagId: string, data: TagUpdateInput) => update.mutateAsync({ tagId, data }),
    updating: update.isPending,
  };
}
