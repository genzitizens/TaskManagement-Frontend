import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TaskModal from './TaskModal';
import type { ProjectRes, TaskRes } from '../types';

describe('TaskModal', () => {
  it('pre-populates note details when editing a task', () => {
    const project: ProjectRes = {
      id: '11111111-2222-3333-4444-555555555555',
      name: 'Project One',
      description: 'Example project',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const task: TaskRes = {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      projectId: project.id,
      title: 'Draft proposal',
      description: 'Draft the initial proposal',
      endAt: '2024-01-10T12:00:00.000Z',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
      isActivity: false,
      note: {
        id: '99999999-8888-7777-6666-555555555555',
        taskId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
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

describe('TaskModal note actions', () => {
  const project: ProjectRes = {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Project One',
    description: 'Example project',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  it('submits a create note action when adding a note to a new task', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TaskModal
        isOpen
        mode="create"
        projects={[project]}
        defaultProjectId={project.id}
        submitting={false}
        onSubmit={handleSubmit}
        onClose={() => {}}
      />,
    );

    const projectSelect = screen.getByLabelText('Project');
    await user.click(projectSelect);
    await user.click(screen.getByRole('option', { name: 'Project One' }));
    await waitFor(() => expect((projectSelect as HTMLSelectElement).value).toBe(project.id));
    await user.type(screen.getByLabelText('Title'), 'Write launch brief');
    await user.type(screen.getByLabelText('Due'), '2024-01-10T12:00');

    await user.click(screen.getByLabelText(/add note/i));
    await user.type(screen.getByLabelText('Note'), 'Outline the talking points.');

    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());

    expect(handleSubmit).toHaveBeenCalledWith({
      task: expect.objectContaining({
        projectId: project.id,
        title: 'Write launch brief',
        endAt: expect.any(String),
      }),
      noteAction: { type: 'create', body: 'Outline the talking points.' },
    });
  });

  it('submits an update note action when editing an existing note', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    const task: TaskRes = {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      projectId: project.id,
      title: 'Draft proposal',
      description: 'Draft the initial proposal',
      endAt: '2024-01-10T12:00:00.000Z',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z',
      isActivity: false,
      note: {
        id: '99999999-8888-7777-6666-555555555555',
        taskId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
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
        onSubmit={handleSubmit}
        onClose={() => {}}
      />,
    );

    const editProjectSelect = screen.getByLabelText('Project');
    await user.click(editProjectSelect);
    await user.click(screen.getByRole('option', { name: 'Project One' }));
    await waitFor(() => expect((editProjectSelect as HTMLSelectElement).value).toBe(project.id));
    const noteField = screen.getByLabelText('Note');
    await user.clear(noteField);
    await user.type(noteField, 'Update the budget numbers.');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());

    expect(handleSubmit).toHaveBeenCalledWith({
      task: expect.objectContaining({
        projectId: project.id,
        title: 'Draft proposal',
        endAt: expect.any(String),
      }),
      noteAction: {
        type: 'update',
        id: '99999999-8888-7777-6666-555555555555',
        body: 'Update the budget numbers.',
      },
    });
  });

  it('submits a delete note action when removing an existing note', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    const task: TaskRes = {
      id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      projectId: project.id,
      title: 'Review contract',
      description: 'Review vendor contract terms',
      endAt: '2024-01-15T09:00:00.000Z',
      createdAt: '2024-01-05T00:00:00.000Z',
      updatedAt: '2024-01-06T00:00:00.000Z',
      isActivity: false,
      note: {
        id: '44444444-3333-2222-1111-000000000000',
        taskId: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
        body: 'Confirm clause 4 is updated.',
        createdAt: '2024-01-05T00:00:00.000Z',
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
        onSubmit={handleSubmit}
        onClose={() => {}}
      />,
    );

    const deleteProjectSelect = screen.getByLabelText('Project');
    await user.click(deleteProjectSelect);
    await user.click(screen.getByRole('option', { name: 'Project One' }));
    await waitFor(() => expect((deleteProjectSelect as HTMLSelectElement).value).toBe(project.id));
    await user.click(screen.getByLabelText(/add note/i));

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalled());

    expect(handleSubmit).toHaveBeenCalledWith({
      task: expect.objectContaining({
        projectId: project.id,
        title: 'Review contract',
        endAt: expect.any(String),
      }),
      noteAction: { type: 'delete', id: '44444444-3333-2222-1111-000000000000' },
    });
  });
});
