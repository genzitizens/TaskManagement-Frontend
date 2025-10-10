import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { createProject, listProjects } from '../api/projects';
import type { ProjectCreateInput, ProjectRes, ProjectUpdateInput } from '../types';
import { queryClient } from '../queryClient';

const PROJECTS_QUERY_KEY = ['projects'];

export function useProjects() {
  const query = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => listProjects(),
  });

  const mutation = useMutation({
    mutationFn: (input: ProjectCreateInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
    onError: (error) => { console.error('Error creating project:', error); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProjectUpdateInput }) => {
      const body = JSON.stringify(input);
      try {
        return await apiRequest<ProjectRes>(`/api/projects/${id}`, {
          method: 'PATCH',
          body,
        });
      } catch (error) {
        const shouldRetryWithPut = (() => {
          if (error instanceof Error) {
            try {
              const parsed = JSON.parse(error.message) as { status?: number };
              if (parsed?.status === 405) {
                return true;
              }
            } catch {
              // ignore parse errors and fall back to string inspection
              if (error.message.includes('405')) {
                return true;
              }
            }
          }
          return false;
        })();

        if (!shouldRetryWithPut) {
          throw error;
        }

        return apiRequest<ProjectRes>(`/api/projects/${id}`, {
          method: 'PUT',
          body,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    },
    onError: (error) => {
      console.error('Error updating project:', error);
    },
  });

  return {
    ...query,
    createProject: mutation.mutateAsync,
    creating: mutation.isPending,
    updateProject: updateMutation.mutateAsync,
    updating: updateMutation.isPending,
  };
}
