import { useMutation, useQuery } from '@tanstack/react-query';
import { createProject, listProjects } from '../api/projects';
import type { ProjectCreateInput } from '../types';
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

  return { ...query, createProject: mutation.mutateAsync, creating: mutation.isPending };
}
