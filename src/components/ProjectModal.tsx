import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import type { ProjectRes, ProjectUpdateInput } from '../types';

type ProjectModalMode = 'create' | 'edit';

type FormState = {
  name: string;
  description: string;
};

const initialState: FormState = {
  name: '',
  description: '',
};

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(160, 'Name must be 160 characters or fewer'),
  description: z
    .string()
    .max(10000, 'Description must be 10,000 characters or fewer')
    .optional(),
});

export interface ProjectModalProps {
  isOpen: boolean;
  mode: ProjectModalMode;
  project: ProjectRes | null;
  submitting: boolean;
  onSubmit: (input: ProjectUpdateInput) => Promise<void>;
  onClose: () => void;
}

export default function ProjectModal({
  isOpen,
  mode,
  project,
  submitting,
  onSubmit,
  onClose,
}: ProjectModalProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'edit' && project) {
      setForm({
        name: project.name,
        description: project.description ?? '',
      });
    } else if (isOpen && mode === 'create') {
      setForm(initialState);
    }
    if (isOpen) {
      setFormError(null);
    }
  }, [isOpen, mode, project?.id, project?.name, project?.description]);

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
    });

    if (!result.success) {
      const first = result.error.issues.at(0);
      setFormError(first?.message ?? 'Invalid input');
      return;
    }

    try {
      const payload: ProjectUpdateInput = { ...result.data };
      await onSubmit(payload);
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save project');
    }
  };

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (submitting) {
      return;
    }
    onClose();
  };

  return (
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
            disabled={submitting}
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
          {formError ? <p className="error-message">{formError}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
