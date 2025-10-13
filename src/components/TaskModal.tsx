import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { z } from 'zod';
import type { ProjectRes, TaskCreateInput, TaskRes } from '../types';

const taskSchema = z.object({
  projectId: z.string().uuid({ message: 'Select a project' }),
  title: z.string().min(1, 'Title is required').max(160, 'Title must be 160 characters or fewer'),
  description: z
    .string()
    .max(10000, 'Description must be 10,000 characters or fewer')
    .optional(),
  endAt: z.string().min(1, 'Due date is required'),
  isActivity: z.boolean().optional(),
});

interface FormState {
  projectId: string;
  title: string;
  description: string;
  endAt: string;
  isActivity: boolean;
}

const toDateTimeLocal = (date: string) => {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.local().format('YYYY-MM-DDTHH:mm') : '';
};

const createInitialState = (projectId?: string, task?: TaskRes | null): FormState => {
  if (task) {
    return {
      projectId: task.projectId,
      title: task.title,
      description: task.description ?? '',
      endAt: toDateTimeLocal(task.endAt),
      isActivity: Boolean(task.isActivity),
    };
  }

  return {
    projectId: projectId ?? '',
    title: '',
    description: '',
    endAt: '',
    isActivity: false,
  };
};

export interface TaskModalProps {
  isOpen: boolean;
  projects: ProjectRes[];
  defaultProjectId?: string;
  task?: TaskRes | null;
  mode?: 'create' | 'edit';
  submitting: boolean;
  onSubmit: (input: TaskCreateInput, taskId?: string) => Promise<void>;
  onClose: () => void;
}

export default function TaskModal({
  isOpen,
  projects,
  defaultProjectId,
  task = null,
  mode = 'create',
  submitting,
  onSubmit,
  onClose,
}: TaskModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialState(defaultProjectId, task));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm(createInitialState(task?.projectId ?? defaultProjectId, task));
    setFormError(null);
  }, [defaultProjectId, isOpen, task]);

  const isEditMode = mode === 'edit';

  const submitLabel = useMemo(() => {
    if (submitting) {
      return isEditMode ? 'Saving…' : 'Creating…';
    }
    return isEditMode ? 'Save changes' : 'Create task';
  }, [isEditMode, submitting]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (submitting) {
      return;
    }
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const result = taskSchema.safeParse({
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

    const payload: TaskCreateInput = {
      ...result.data,
      endAt: dueDate.toISOString(),
    };

    try {
      await onSubmit(payload, task?.id);
      onClose();
    } catch (error) {
      const defaultMessage = isEditMode ? 'Failed to update task' : 'Failed to create task';
      setFormError(error instanceof Error ? error.message : defaultMessage);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="task-modal-title">{isEditMode ? 'Edit Task' : 'Add Task'}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close task form"
            disabled={submitting}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="task-project-modal">Project</label>
            <select
              id="task-project-modal"
              name="projectId"
              value={form.projectId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  projectId: event.target.value,
                }))
              }
              required
              disabled={submitting}
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
            <label htmlFor="task-title-modal">Title</label>
            <input
              id="task-title-modal"
              name="title"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              placeholder="Prep release notes"
              maxLength={160}
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="task-description-modal">Description</label>
            <textarea
              id="task-description-modal"
              name="description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Add more details"
              rows={3}
              maxLength={10000}
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="task-end-modal">Due</label>
            <input
              id="task-end-modal"
              name="endAt"
              type="datetime-local"
              value={form.endAt}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  endAt: event.target.value,
                }))
              }
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={form.isActivity}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isActivity: event.target.checked,
                  }))
                }
                disabled={submitting}
              />{' '}
              Activity task
            </label>
          </div>
          {formError ? <p className="error-message">{formError}</p> : null}
          <div className="modal-actions">
            <button type="submit" disabled={submitting}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
