import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { createProject, listProjects } from '../api/projects';
import type { ProjectCreateInput, ProjectRes } from '../types';
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
    mutationFn: ({ id, input }: { id: string; input: ProjectCreateInput }) =>
      apiRequest<ProjectRes>(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
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
