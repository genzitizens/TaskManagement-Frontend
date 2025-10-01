import { useMutation, useQuery } from '@tanstack/react-query';
import { createNote, listNotes } from '../api/notes';
import type { NoteCreateInput } from '../types';
import { queryClient } from '../queryClient';

export function useNotes(filters: { projectId?: string; taskId?: string }) {
  const queryKey = ['notes', filters];

  const query = useQuery({
    queryKey,
    queryFn: () => listNotes(filters),
    enabled: Boolean(filters.projectId || filters.taskId),
  });

  const mutation = useMutation({
    mutationFn: (input: NoteCreateInput) => createNote(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, createNote: mutation.mutateAsync, creating: mutation.isPending };
}
