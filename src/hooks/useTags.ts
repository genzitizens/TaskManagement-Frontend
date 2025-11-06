import { useMutation, useQuery } from '@tanstack/react-query';
import { createTag, listTags } from '../api/tags';
import type { Page, TagCreateInput, TagRes } from '../types';
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
        (tagA, tagB) => new Date(tagA.createdAt).getTime() - new Date(tagB.createdAt).getTime(),
      ),
    }),
  });

  const create = useMutation({
    mutationFn: (payload: TagCreateInput) => createTag(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    ...query,
    createTag: create.mutateAsync,
    creating: create.isPending,
  };
}
