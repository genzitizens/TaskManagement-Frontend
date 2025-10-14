import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TaskModal from './TaskModal';
import type { ProjectRes, TaskRes } from '../types';

describe('TaskModal', () => {
  it('pre-populates note details when editing a task', () => {
    const project: ProjectRes = {
      id: 'project-1',
      name: 'Project One',
      description: 'Example project',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const task: TaskRes = {
      id: 'task-1',
      projectId: project.id,
      title: 'Draft proposal',
      description: 'Draft the initial proposal',
      endAt: '2024-01-10T12:00:00.000Z',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
      isActivity: false,
      note: {
        id: 'note-1',
        taskId: 'task-1',
        body: 'Remember to include the budget section.',
        createdAt: '2024-01-02T00:00:00.000Z',
      },
    };

    render(
      <TaskModal
        isOpen
        mode="edit"
        projects={[project]}
        defaultProjectId={project.id}
        submitting={false}
        task={task}
        onSubmit={async () => {}}
        onClose={() => {}}
      />,
    );

    const addNoteCheckbox = screen.getByLabelText(/add note/i) as HTMLInputElement;
    expect(addNoteCheckbox.checked).toBe(true);

    const noteField = screen.getByLabelText('Note') as HTMLTextAreaElement;
    expect(noteField.value).toBe('Remember to include the budget section.');
  });
});
