import { FormEvent, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { z } from 'zod';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useSearchParams } from 'react-router-dom';

const schema = z.object({
  projectId: z.string().uuid({ message: 'Select a project' }),
  title: z.string().min(1, 'Title is required').max(160, 'Title must be 160 characters or fewer'),
  description: z.string().max(10000, 'Description must be 10,000 characters or fewer').optional(),
  endAt: z.string().min(1, 'Due date is required'),
  isActivity: z.boolean().optional(),
});

type FormState = {
  projectId: string;
  title: string;
  description: string;
  endAt: string;
  isActivity: boolean;
};

const initialState: FormState = {
  projectId: '',
  title: '',
  description: '',
  endAt: '',
  isActivity: false,
};

export default function TasksPage() {
  const { data: projectData } = useProjects();
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const projectParam = searchParams.get('projectId');
    if (!projectParam) {
      return;
    }

    setForm((prev) => {
      if (prev.projectId === projectParam) {
        return prev;
      }
      return { ...prev, projectId: projectParam };
    });
  }, [searchParams]);

  const tasksHook = useTasks(form.projectId || undefined);
  const { data, isLoading, isError, error, createTask, creating, deleteTask, deleting } = tasksHook;

  const projects = projectData?.content ?? [];
  const tasks = data?.content ?? [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const result = schema.safeParse({
      projectId: form.projectId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      endAt: form.endAt,
      isActivity: form.isActivity,
    });

    if (!result.success) {
      const first = result.error.issues.at(0);
      setFormError(first?.message ?? 'Invalid input');
      return;
    }

    const dueDate = dayjs(result.data.endAt);
    if (!dueDate.isValid()) {
      setFormError('Provide a valid due date');
      return;
    }

    try {
      await createTask({
        ...result.data,
        endAt: dueDate.toISOString(),
      });
      setForm((prev) => ({ ...initialState, projectId: prev.projectId }));
    } catch (mutationError) {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Failed to create task');
    }
  };

  return (
    <div className="card">
      <h2>Tasks</h2>
      <p>Tasks keep work scoped to a single project. Select a project to view tasks and add new ones.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="task-project">Project</label>
          <select
            id="task-project"
            name="projectId"
            value={form.projectId}
            onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value }))}
            required
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            name="title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Prep release notes"
            maxLength={160}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="task-description">Description</label>
          <textarea
            id="task-description"
            name="description"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Add more details"
            rows={3}
            maxLength={10000}
          />
        </div>
        <div className="field">
          <label htmlFor="task-end">Due</label>
          <input
            id="task-end"
            name="endAt"
            type="datetime-local"
            value={form.endAt}
            onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.isActivity}
              onChange={(event) => setForm((prev) => ({ ...prev, isActivity: event.target.checked }))}
            />{' '}
            Activity task
          </label>
        </div>
        {formError ? <p className="error-message">{formError}</p> : null}
        <button type="submit" disabled={creating || !form.projectId}>
          {creating ? 'Creating…' : 'Create task'}
        </button>
      </form>

      <section>
        <h3>Upcoming tasks</h3>
        {!form.projectId ? <p>Select a project to load tasks.</p> : null}
        {form.projectId && isLoading ? <p>Loading tasks…</p> : null}
        {form.projectId && isError ? (
          <p className="error-message">{error instanceof Error ? error.message : 'Failed to load tasks'}</p>
        ) : null}
        {form.projectId && !isLoading && !tasks.length ? <p>No tasks yet.</p> : null}
        <ul className="list">
          {tasks.map((task) => (
            <li key={task.id} className="list-item">
              <strong>{task.title}</strong>
              {task.description ? <p>{task.description}</p> : null}
              <p className="badge">Due {dayjs(task.endAt).format('MMM D, YYYY h:mm A')}</p>
              <button
                type="button"
                onClick={() => void deleteTask(task.id)}
                disabled={deleting}
                style={{ marginTop: '0.75rem', background: '#dc2626' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
