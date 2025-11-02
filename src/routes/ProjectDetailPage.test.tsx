import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetailPage from './ProjectDetailPage';
import type { TaskRes } from '../types';

vi.mock('../hooks/useProject', () => ({
  useProject: vi.fn(),
}));

vi.mock('../hooks/useTasks', () => ({
  useTasks: vi.fn(),
}));

vi.mock('../api/notes', () => ({
  listNotes: vi.fn(),
}));

const { useProject } = await import('../hooks/useProject');
const { useTasks } = await import('../hooks/useTasks');
const { listNotes } = await import('../api/notes');

const mockedUseProject = useProject as unknown as vi.Mock;
const mockedUseTasks = useTasks as unknown as vi.Mock;
const mockedListNotes = listNotes as unknown as vi.Mock;

const projectResponse = {
  data: {
    id: 'project-1',
    name: 'Example Project',
    description: 'Example description',
    startDate: '2024-01-01T00:00:00.000Z',
    createdAt: '2023-12-31T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  isLoading: false,
  isError: false,
  error: null,
};

const createTaskHookResponse = (tasks: TaskRes[]) => ({
  data: { content: tasks, totalElements: tasks.length, totalPages: 1, size: tasks.length, number: 0, numberOfElements: tasks.length },
  isLoading: false,
  isError: false,
  error: null,
  createTask: vi.fn(),
  creating: false,
  deleteTask: vi.fn(),
  deleting: false,
  updateTask: vi.fn(),
  updating: false,
});

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseProject.mockReturnValue(projectResponse);
  });

  it('renders tooltip content for tasks with notes fetched separately', async () => {
    const task: TaskRes = {
      id: 'task-1',
      projectId: 'project-1',
      title: 'Task with remote note',
      duration: 2,
      startAt: '2024-01-05T00:00:00.000Z',
      endAt: '2024-01-06T00:00:00.000Z',
      createdAt: '2024-01-04T00:00:00.000Z',
      updatedAt: '2024-01-06T00:00:00.000Z',
    };

    mockedUseTasks.mockReturnValue(createTaskHookResponse([task]));

    mockedListNotes.mockResolvedValue({
      content: [
        {
          id: 'note-1',
          body: 'Fetched note body',
          taskId: task.id,
          createdAt: '2024-01-06T12:00:00.000Z',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 1,
      number: 0,
      numberOfElements: 1,
    });

    render(
      <MemoryRouter initialEntries={[`/projects/${projectResponse.data.id}`]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockedListNotes).toHaveBeenCalledWith({ taskId: task.id, size: 1 }));

    await screen.findByText('Note: Fetched note body');

    await waitFor(() => {
      const popover = document.querySelector('.project-grid__note-popover');
      expect(popover?.textContent).toContain('Fetched note body');
    });
  });
});
