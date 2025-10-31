import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { z } from 'zod';
import type { NoteAction, ProjectRes, TaskCreateInput, TaskRes, TaskWithNoteInput } from '../types';
import { toBoolean } from '../utils/toBoolean';

const taskSchema = z.object({
  projectId: z.string().uuid({ message: 'Select a project' }),
  title: z.string().min(1, 'Title is required').max(160, 'Title must be 160 characters or fewer'),
  description: z
    .string()
    .max(10000, 'Description must be 10,000 characters or fewer')
    .optional(),
  duration: z
    .string()
    .trim()
    .min(1, 'Duration is required')
    .regex(/^[0-9]+$/, 'Duration must be a whole number')
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => value > 0, { message: 'Duration must be at least 1 day' }),
  startAt: z.string().min(1, 'Start date is required'),
  endAt: z.string().min(1, 'Due date is required'),
  isActivity: z.boolean().optional(),
});

interface FormState {
  projectId: string;
  title: string;
  description: string;
  duration: string;
  startAt: string;
  endAt: string;
  isActivity: boolean;
  hasNote: boolean;
  note: string;
}

const formatDateLocal = (value: string) => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
};

const createInitialState = (projectId?: string, task?: TaskRes | null): FormState => {
  if (task) {
    return {
      projectId: task.projectId,
      title: task.title,
      description: task.description ?? '',
      duration: task.duration.toString(),
      startAt: formatDateLocal(task.startAt),
      endAt: formatDateLocal(task.endAt),
      isActivity: toBoolean(task.isActivity),
      hasNote: Boolean(task.note),
      note: task.note?.body ?? '',
    };
  }

  return {
    projectId: projectId ?? '',
    title: '',
    description: '',
    duration: '',
    startAt: '',
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

    const initialState = createInitialState(defaultProjectId, task);

    if (mode === 'edit') {
      // eslint-disable-next-line no-console -- Logging backend task payload for debugging edit flow
      console.log('TaskModal edit task data', task ?? null);
    }

    setForm(initialState);
    setFormError(null);
  }, [defaultProjectId, isOpen, mode, task]);

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
      duration: form.duration,
      startAt: form.startAt,
      endAt: form.endAt,
      isActivity: form.isActivity,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setFormError(firstIssue?.message ?? 'Invalid input');
      return;
    }

    const { startAt, endAt, duration, ...rest } = result.data;

    const startDate = dayjs(startAt).startOf('day');
    const dueDate = dayjs(endAt).startOf('day');
    if (!startDate.isValid()) {
      setFormError('Provide a valid start date');
      return;
    }
    if (!dueDate.isValid()) {
      setFormError('Provide a valid due date');
      return;
    }
    if (dueDate.isBefore(startDate)) {
      setFormError('Due date must be after the start date');
      return;
    }

    const selectedProject = projects.find((project) => project.id === rest.projectId);
    if (!selectedProject) {
      setFormError('Select a project');
      return;
    }

    const projectStartDate = dayjs(selectedProject.startDate).startOf('day');
    if (!projectStartDate.isValid()) {
      setFormError('Selected project has an invalid start date');
      return;
    }

    const computedStartDay = Math.max(1, startDate.diff(projectStartDate, 'day') + 1);
    const computedEndDay = Math.max(
      computedStartDay,
      dueDate.diff(projectStartDate, 'day') + 1,
    );

    const payload: TaskCreateInput = {
      ...rest,
      duration,
      startAt: startDate.toISOString(),
      endAt: dueDate.toISOString(),
      startDay: computedStartDay,
      endDay: computedEndDay,
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
            <label htmlFor="task-duration-modal">Duration (days)</label>
            <input
              id="task-duration-modal"
              name="duration"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.duration}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  duration: event.target.value,
                }))
              }
              placeholder="e.g. 5"
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="task-start-modal">Start</label>
            <input
              id="task-start-modal"
              name="startAt"
              type="date"
              value={form.startAt}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  startAt: event.target.value,
                }))
              }
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="task-end-modal">Due</label>
            <input
              id="task-end-modal"
              name="endAt"
              type="date"
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
