import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { z } from 'zod';
import type { NoteAction, ProjectRes, TaskCreateInput, TaskRes, TaskWithNoteInput } from '../types';

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
  hasNote: boolean;
  note: string;
}

const formatDateTimeLocal = (value: string) => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DDTHH:mm') : '';
};

const createInitialState = (projectId?: string, task?: TaskRes | null): FormState => {
  if (task) {
    return {
      projectId: task.projectId,
      title: task.title,
      description: task.description ?? '',
      endAt: formatDateTimeLocal(task.endAt),
      isActivity: Boolean(task.isActivity),
      hasNote: Boolean(task.note?.body),
      note: task.note?.body ?? '',
    };
  }

  return {
    projectId: projectId ?? '',
    title: '',
    description: '',
    endAt: '',
    isActivity: false,
    hasNote: false,
    note: '',
  };
};

export type TaskModalMode = 'create' | 'edit';

export interface TaskModalProps {
  isOpen: boolean;
  projects: ProjectRes[];
  defaultProjectId?: string;
  submitting: boolean;
  onSubmit: (input: TaskWithNoteInput) => Promise<void>;
  onClose: () => void;
  mode?: TaskModalMode;
  task?: TaskRes | null;
}

export default function TaskModal({
  isOpen,
  projects,
  defaultProjectId,
  submitting,
  onSubmit,
  onClose,
  mode = 'create',
  task,
}: TaskModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialState(defaultProjectId, task));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setForm(createInitialState(defaultProjectId, task));
    setFormError(null);
  }, [defaultProjectId, isOpen, task]);

  const submitLabel = useMemo(() => {
    if (mode === 'edit') {
      return submitting ? 'Saving…' : 'Save changes';
    }
    return submitting ? 'Creating…' : 'Create task';
  }, [mode, submitting]);

  const modalTitle = mode === 'edit' ? 'Edit Task' : 'Add Task';

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

    const trimmedNote = form.note.trim();

    if (form.hasNote) {
      if (!trimmedNote) {
        setFormError('Provide a note');
        return;
      }
      if (trimmedNote.length > NOTE_MAX_LENGTH) {
        setFormError(`Note must be ${NOTE_MAX_LENGTH.toLocaleString()} characters or fewer`);
        return;
      }
    }

    const noteAction = determineNoteAction({
      hasNote: form.hasNote,
      note: trimmedNote,
      existingNote: task?.note ?? null,
    });

    try {
      await onSubmit({ task: payload, noteAction });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save task');
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
          <h3 id="task-modal-title">{modalTitle}</h3>
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
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={form.hasNote}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    hasNote: event.target.checked,
                  }))
                }
                disabled={submitting}
              />{' '}
              Add note
            </label>
          </div>
          {form.hasNote ? (
            <div className="field">
              <label htmlFor="task-note-modal">Note</label>
              <textarea
                id="task-note-modal"
                name="note"
                value={form.note}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
                placeholder="Add important context"
                rows={4}
                maxLength={NOTE_MAX_LENGTH}
                disabled={submitting}
              />
            </div>
          ) : null}
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

const NOTE_MAX_LENGTH = 20000;

function determineNoteAction({
  hasNote,
  note,
  existingNote,
}: {
  hasNote: boolean;
  note: string;
  existingNote: TaskRes['note'] | null;
}): NoteAction {
  if (!hasNote) {
    if (existingNote) {
      return { type: 'delete', id: existingNote.id };
    }
    return { type: 'none' };
  }

  if (!note) {
    return { type: 'none' };
  }

  if (!existingNote) {
    return { type: 'create', body: note };
  }

  if (existingNote.body !== note) {
    return { type: 'update', id: existingNote.id, body: note };
  }

  return { type: 'none' };
}
