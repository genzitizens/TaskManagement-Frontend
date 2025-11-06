import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { z } from 'zod';
import type { ProjectRes, TagCreateInput } from '../types';

dayjs.extend(customParseFormat);

const API_START_DATE_FORMAT = 'DD-MM-YYYY';

const parseProjectStartDate = (value: string) => {
  const isoParsed = dayjs(value);
  if (isoParsed.isValid()) {
    return isoParsed;
  }

  const apiParsed = dayjs(value, API_START_DATE_FORMAT, true);
  if (apiParsed.isValid()) {
    return apiParsed;
  }

  return null;
};

const tagSchema = z.object({
  projectId: z.string().uuid({ message: 'Select a project' }),
  title: z.string().min(1, 'Title is required').max(160, 'Title must be 160 characters or fewer'),
  description: z
    .string()
    .max(10000, 'Description must be 10,000 characters or fewer')
    .optional(),
  startAt: z.string().min(1, 'Start date is required'),
  endAt: z.string().min(1, 'End date is required'),
});

interface FormState {
  projectId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
}

const createInitialState = (projectId?: string): FormState => ({
  projectId: projectId ?? '',
  title: '',
  description: '',
  startAt: '',
  endAt: '',
});

export interface TagModalProps {
  isOpen: boolean;
  projects: ProjectRes[];
  defaultProjectId?: string;
  submitting: boolean;
  onSubmit: (input: TagCreateInput) => Promise<void>;
  onClose: () => void;
}

export default function TagModal({
  isOpen,
  projects,
  defaultProjectId,
  submitting,
  onSubmit,
  onClose,
}: TagModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialState(defaultProjectId));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(createInitialState(defaultProjectId));
    setFormError(null);
  }, [defaultProjectId, isOpen]);

  const submitLabel = useMemo(
    () => (submitting ? 'Creating…' : 'Create tag'),
    [submitting],
  );

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

    const result = tagSchema.safeParse({
      projectId: form.projectId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startAt: form.startAt,
      endAt: form.endAt,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setFormError(firstIssue?.message ?? 'Invalid input');
      return;
    }

    const { startAt, endAt, ...rest } = result.data;

    const startDate = dayjs(startAt).startOf('day');
    const endDate = dayjs(endAt).startOf('day');
    if (!startDate.isValid()) {
      setFormError('Provide a valid start date');
      return;
    }
    if (!endDate.isValid()) {
      setFormError('Provide a valid end date');
      return;
    }
    if (endDate.isBefore(startDate)) {
      setFormError('End date must be on or after the start date');
      return;
    }

    const project = projects.find((item) => item.id === rest.projectId);
    if (!project) {
      setFormError('Select a project');
      return;
    }

    const projectStartDate = parseProjectStartDate(project.startDate);
    if (!projectStartDate) {
      setFormError('Project start date is invalid');
      return;
    }

    const normalizedProjectStartDate = projectStartDate.startOf('day');

    if (startDate.isBefore(normalizedProjectStartDate)) {
      setFormError('Tag start date must be on or after the project start date');
      return;
    }

    if (endDate.isBefore(normalizedProjectStartDate)) {
      setFormError('Tag end date must be on or after the project start date');
      return;
    }

    const duration = endDate.diff(startDate, 'day') + 1;
    const startDay = startDate.diff(normalizedProjectStartDate, 'day') + 1;
    const endDay = endDate.diff(normalizedProjectStartDate, 'day') + 1;

    if (startDay < 1 || endDay < 1) {
      setFormError('Tag dates must be on or after the project start date');
      return;
    }

    const payload: TagCreateInput = {
      ...rest,
      duration,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      start_day: startDay,
      end_day: endDay,
      isActivity: false,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save tag');
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="tag-modal-title">Add Tag</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close tag form"
            disabled={submitting}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="tag-project-modal">Project</label>
            <select
              id="tag-project-modal"
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
            <label htmlFor="tag-title-modal">Title</label>
            <input
              id="tag-title-modal"
              name="title"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              placeholder="Launch announcement"
              maxLength={160}
              required
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="tag-description-modal">Description</label>
            <textarea
              id="tag-description-modal"
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
            <label htmlFor="tag-start-modal">Start</label>
            <input
              id="tag-start-modal"
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
            <label htmlFor="tag-end-modal">End</label>
            <input
              id="tag-end-modal"
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
