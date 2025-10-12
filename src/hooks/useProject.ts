import { useQuery } from '@tanstack/react-query';
import { getProject } from '../api/projects';

export function useProject(projectId?: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      return getProject(projectId);
    },
    enabled: Boolean(projectId),
  });
}
