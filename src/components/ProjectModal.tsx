import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { z } from 'zod';
import type { ProjectCreateInput, ProjectRes } from '../types';

type ProjectModalMode = 'create' | 'edit';

type FormState = {
  name: string;
  description: string;
  startDate: string;
};

const createInitialState = (): FormState => ({
  name: '',
  description: '',
  startDate: dayjs().format('YYYY-MM-DD'),
});

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(160, 'Name must be 160 characters or fewer'),
  description: z
    .string()
    .max(10000, 'Description must be 10,000 characters or fewer')
    .optional(),
  startDate: z
    .string()
    .min(1, 'Start date is required')
    .refine((value) => dayjs(value, 'YYYY-MM-DD', true).isValid(), {
      message: 'Provide a valid start date',
    }),
});

export interface ProjectModalProps {
  isOpen: boolean;
  mode: ProjectModalMode;
  project: ProjectRes | null;
  submitting: boolean;
  deleting?: boolean;
  onSubmit: (input: ProjectCreateInput) => Promise<void>;
  onDelete?: (project: ProjectRes) => Promise<void>;
  onClose: () => void;
}

export default function ProjectModal({
  isOpen,
  mode,
  project,
  submitting,
  deleting = false,
  onSubmit,
  onDelete,
  onClose,
}: ProjectModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialState());
  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'edit' && project) {
      const parsedStartDate = project.startDate ? dayjs(project.startDate) : null;
      setForm({
        name: project.name,
        description: project.description ?? '',
        startDate: parsedStartDate?.isValid()
          ? parsedStartDate.format('YYYY-MM-DD')
          : dayjs(project.createdAt).format('YYYY-MM-DD'),
      });
    } else if (isOpen && mode === 'create') {
      setForm(createInitialState());
    }
    if (isOpen) {
      setFormError(null);
      setDeleteError(null);
      setShowDeleteConfirm(false);
    }
  }, [
    isOpen,
    mode,
    project?.id,
    project?.name,
    project?.description,
    project?.startDate,
    project?.createdAt,
  ]);

  const submitLabel = useMemo(() => {
    if (submitting) {
      return mode === 'edit' ? 'Saving…' : 'Creating…';
    }
    return mode === 'edit' ? 'Save changes' : 'Create project';
  }, [mode, submitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const result = projectSchema.safeParse({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      startDate: form.startDate,
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setFormError(firstIssue?.message ?? 'Invalid input');
      return;
    }

    const payload: ProjectCreateInput = {
      ...result.data,
      startDate: dayjs(result.data.startDate).format('MM/DD/YYYY'),
      title: result.data.name,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save project');
    }
  };

  const handleDeleteClick = () => {
    if (!project || !onDelete) {
      return;
    }
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!project || !onDelete) {
      return;
    }
    setDeleteError(null);
    try {
      await onDelete(project);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  const handleDeleteCancel = () => {
    if (deleting) {
      return;
    }
    setShowDeleteConfirm(false);
    setDeleteError(null);
  };

  if (!isOpen) {
    return null;
  }

  const isBusy = submitting || deleting;

  const handleBackdropClick = () => {
    if (isBusy) {
      return;
    }
    onClose();
  };

  return (
    <>
      <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header">
            <h3 id="project-modal-title">{mode === 'edit' ? 'Edit Project' : 'Add Project'}</h3>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close project form"
              disabled={isBusy}
            >
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="project-name-modal">Name</label>
              <input
                id="project-name-modal"
                name="name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Summer roadmap"
                required
                maxLength={160}
                disabled={submitting}
              />
            </div>
          <div className="field">
            <label htmlFor="project-description-modal">Description</label>
            <textarea
              id="project-description-modal"
              name="description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="What are we delivering?"
                maxLength={10000}
                rows={3}
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="project-start-date-modal">Start date</label>
              <input
                id="project-start-date-modal"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
                required
                disabled={submitting}
              />
            </div>
            {formError ? <p className="error-message">{formError}</p> : null}
            <div className="modal-actions">
              {mode === 'edit' && onDelete ? (
                <button
                  type="button"
                  className="button-danger"
                  onClick={handleDeleteClick}
                  disabled={isBusy}
                >
                  Delete project
                </button>
              ) : null}
              <button type="submit" disabled={isBusy}>
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
      {mode === 'edit' && onDelete && project ? (
        <DeleteProjectModal
          isOpen={showDeleteConfirm}
          project={project}
          submitting={deleting}
          error={deleteError}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </>
  );
}

interface DeleteProjectModalProps {
  isOpen: boolean;
  project: ProjectRes | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteProjectModal({
  isOpen,
  project,
  submitting,
  error,
  onCancel,
  onConfirm,
}: DeleteProjectModalProps) {
  if (!isOpen || !project) {
    return null;
  }

  const handleBackdropClick = () => {
    if (submitting) {
      return;
    }
    onCancel();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleBackdropClick}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="delete-project-modal-title">Delete project</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            aria-label="Close delete confirmation"
            disabled={submitting}
          >
            ×
          </button>
        </div>
        <div>
          <p>
            Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone.
          </p>
          {error ? <p className="error-message">{error}</p> : null}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={() => {
              void onConfirm();
            }}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  );
}
