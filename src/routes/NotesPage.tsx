import { FormEvent, useState } from 'react';
import dayjs from 'dayjs';
import { z } from 'zod';
import { useProjects } from '../hooks/useProjects';
import { useNotes } from '../hooks/useNotes';

const schema = z
  .object({
    targetType: z.enum(['project', 'task']),
    projectId: z.string().uuid({ message: 'Select a project' }).optional(),
    taskId: z.string().uuid({ message: 'Provide a task id' }).optional(),
    body: z.string().min(1, 'Body is required').max(20000, 'Body must be 20,000 characters or fewer'),
  })
  .refine(
    (value) =>
      (value.targetType === 'project' && value.projectId && !value.taskId) ||
      (value.targetType === 'task' && value.taskId && !value.projectId),
    {
      message: 'Provide either a project or a task id',
      path: ['targetType'],
    }
  );

type TargetType = 'project' | 'task';

type FormState = {
  targetType: TargetType;
  projectId: string;
  taskId: string;
  body: string;
};

const initialState: FormState = {
  targetType: 'project',
  projectId: '',
  taskId: '',
  body: '',
};

export default function NotesPage() {
  const { data: projectData } = useProjects();
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState<string | null>(null);

  const filters = form.targetType === 'project'
    ? { projectId: form.projectId || undefined, taskId: undefined }
    : { taskId: form.taskId || undefined, projectId: undefined };

  const { data, isLoading, isError, error, createNote, creating } = useNotes(filters);

  const projects = projectData?.content ?? [];
  const notes = data?.content ?? [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const result = schema.safeParse({
      ...form,
      projectId: form.projectId || undefined,
      taskId: form.taskId || undefined,
      body: form.body.trim(),
    });

    if (!result.success) {
      const first = result.error.issues.at(0);
      setFormError(first?.message ?? 'Invalid input');
      return;
    }

    try {
      const payload =
        result.data.targetType === 'project'
          ? { projectId: result.data.projectId!, body: result.data.body }
          : { taskId: result.data.taskId!, body: result.data.body };
      await createNote(payload);
      setForm((prev) => ({ ...initialState, targetType: prev.targetType }));
    } catch (mutationError) {
      setFormError(mutationError instanceof Error ? mutationError.message : 'Failed to create note');
    }
  };

  return (
    <div className="card">
      <h2>Notes</h2>
      <p>Capture context for a project or a specific task. Notes are fetched for the selected scope.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="note-target">Attach to</label>
          <select
            id="note-target"
            value={form.targetType}
            onChange={(event) => {
              const target = event.target.value as TargetType;
              setForm((prev) => ({
                ...prev,
                targetType: target,
                projectId: target === 'project' ? prev.projectId : '',
                taskId: target === 'task' ? prev.taskId : '',
              }));
            }}
          >
            <option value="project">Project</option>
            <option value="task">Task</option>
          </select>
        </div>
        {form.targetType === 'project' ? (
          <div className="field">
            <label htmlFor="note-project">Project</label>
            <select
              id="note-project"
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
        ) : (
          <div className="field">
            <label htmlFor="note-task">Task ID</label>
            <input
              id="note-task"
              value={form.taskId}
              onChange={(event) => setForm((prev) => ({ ...prev, taskId: event.target.value }))}
              placeholder="Task UUID"
              required
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="note-body">Body</label>
          <textarea
            id="note-body"
            value={form.body}
            onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            rows={4}
            maxLength={20000}
            placeholder="Share updates or context"
            required
          />
        </div>
        {formError ? <p className="error-message">{formError}</p> : null}
        <button
          type="submit"
          disabled={
            creating ||
            (form.targetType === 'project' ? !form.projectId : !form.taskId)
          }
        >
          {creating ? 'Saving…' : 'Create note'}
        </button>
      </form>

      <section>
        <h3>Notes</h3>
        {!filters.projectId && !filters.taskId ? <p>Select a scope to load notes.</p> : null}
        {(filters.projectId || filters.taskId) && isLoading ? <p>Loading notes…</p> : null}
        {(filters.projectId || filters.taskId) && isError ? (
          <p className="error-message">{error instanceof Error ? error.message : 'Failed to load notes'}</p>
        ) : null}
        {(filters.projectId || filters.taskId) && !isLoading && !notes.length ? <p>No notes yet.</p> : null}
        <ul className="list">
          {notes.map((note) => (
            <li key={note.id} className="list-item">
              <p>{note.body}</p>
              <p className="badge">Created {dayjs(note.createdAt).format('MMM D, YYYY h:mm A')}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
