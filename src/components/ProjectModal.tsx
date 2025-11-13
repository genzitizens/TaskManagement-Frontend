import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { z } from 'zod';
import type { ProjectCreateInput, ProjectRes } from '../types';
import { createProject, importProject, listProjects } from '../api/projects';
import { queryClient } from '../queryClient';
import DeleteProjectModal from './DeleteProjectModal';

type ProjectModalMode = 'create' | 'edit';

dayjs.extend(customParseFormat);

const API_START_DATE_FORMAT = 'DD-MM-YYYY';

const parseStartDate = (value: string) => {
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

type FormState = {
  name: string;
  description: string;
  startDate: string;
  isImport: boolean;
  sourceProjectId: string;
  importTasks: boolean;
  importNotes: boolean;
  importTags: boolean;
  importActions: boolean;
};

const createInitialState = (): FormState => ({
  name: '',
  description: '',
  startDate: dayjs().format('YYYY-MM-DD'),
  isImport: false,
  sourceProjectId: '',
  importTasks: true,
  importNotes: true,
  importTags: true,
  importActions: true,
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
  const [availableProjects, setAvailableProjects] = useState<ProjectRes[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (isOpen && mode === 'edit' && project) {
      const parsedStartDate = project.startDate ? parseStartDate(project.startDate) : null;
      setForm({
        name: project.name,
        description: project.description ?? '',
        startDate: parsedStartDate?.isValid()
          ? parsedStartDate.format('YYYY-MM-DD')
          : dayjs(project.createdAt, 'DD-MM-YYYY', true).isValid()
            ? dayjs(project.createdAt, 'DD-MM-YYYY', true).format('YYYY-MM-DD')
            : dayjs().format('YYYY-MM-DD'),
        isImport: false,
        sourceProjectId: '',
        importTasks: true,
        importNotes: true,
        importTags: true,
        importActions: true,
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

  // Load available projects for import when import is enabled
  useEffect(() => {
    if (isOpen && mode === 'create' && form.isImport) {
      setLoadingProjects(true);
      listProjects({ size: 100 })
        .then((response) => {
          setAvailableProjects(response.content);
        })
        .catch((error) => {
          console.error('Failed to load projects:', error);
          setFormError('Failed to load available projects');
        })
        .finally(() => {
          setLoadingProjects(false);
        });
    }
  }, [isOpen, mode, form.isImport]);

  const submitLabel = useMemo(() => {
    if (submitting) {
      if (mode === 'edit') return 'Saving…';
      return form.isImport ? 'Importing…' : 'Creating…';
    }
    if (mode === 'edit') return 'Save changes';
    return form.isImport ? 'Import project' : 'Create project';
  }, [mode, submitting, form.isImport]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    // Validate import-specific fields if import is enabled
    if (mode === 'create' && form.isImport) {
      if (!form.sourceProjectId) {
        setFormError('Please select a project to import from');
        return;
      }
    }

    // Create conditional validation schema
    const isImporting = mode === 'create' && form.isImport;
    const validationSchema = isImporting 
      ? projectSchema.omit({ startDate: true }) // Remove startDate requirement for imports
      : projectSchema;

    const result = validationSchema.safeParse({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      ...(isImporting ? {} : { startDate: form.startDate }), // Only include startDate if not importing
    });

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setFormError(firstIssue?.message ?? 'Invalid input');
      return;
    }

    try {
      if (mode === 'create' && form.isImport) {
        // Handle import
        await importProject({
          sourceProjectId: form.sourceProjectId,
          newProjectName: result.data.name,
          description: result.data.description,
          importTasks: form.importTasks,
          importNotes: form.importNotes,
          importTags: form.importTags,
          importActions: form.importActions,
        });
        // Invalidate projects cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      } else {
        // Handle regular create/edit
        const payload: ProjectCreateInput = {
          name: result.data.name,
          description: result.data.description,
          startDate: dayjs(form.startDate).format(API_START_DATE_FORMAT),
          title: result.data.name,
        };
        await onSubmit(payload);
      }
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

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (isBusy) {
      return;
    }
    
    // Only close if clicking in the outer area, not near the modal
    const target = event.target as HTMLElement;
    const modal = event.currentTarget.querySelector('.modal');
    
    if (modal && target === event.currentTarget) {
      const rect = modal.getBoundingClientRect();
      const safeZone = 60; // 60px buffer around modal
      const clickX = event.clientX;
      const clickY = event.clientY;
      
      // Check if click is outside the safe zone
      const isOutsideSafeZone = 
        clickX < rect.left - safeZone ||
        clickX > rect.right + safeZone ||
        clickY < rect.top - safeZone ||
        clickY > rect.bottom + safeZone;
      
      if (isOutsideSafeZone) {
        onClose();
      }
    }
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
            
            {/* Start date field - Only show when not importing or in edit mode */}
            {(mode === 'edit' || !form.isImport) && (
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
            )}
            
            {/* Import Section - Only show for create mode */}
            {mode === 'create' && (
              <div className="field">
                <div className="checkbox-field">
                  <input
                    id="project-import-toggle"
                    type="checkbox"
                    checked={form.isImport}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        isImport: event.target.checked,
                        sourceProjectId: event.target.checked ? prev.sourceProjectId : '',
                        importTasks: event.target.checked ? prev.importTasks : true,
                        importNotes: event.target.checked ? prev.importNotes : true,
                        importTags: event.target.checked ? prev.importTags : true,
                        importActions: event.target.checked ? prev.importActions : true,
                      }))
                    }
                    disabled={submitting}
                  />
                  <label htmlFor="project-import-toggle">Import from existing project</label>
                </div>
                {form.isImport && (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    The start date will be copied from the selected template project.
                  </p>
                )}
              </div>
            )}

            {/* Import Options - Only show when import is enabled */}
            {mode === 'create' && form.isImport && (
              <>
                <div className="field">
                  <label htmlFor="source-project-select">Source Project</label>
                  <select
                    id="source-project-select"
                    value={form.sourceProjectId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sourceProjectId: event.target.value,
                      }))
                    }
                    required
                    disabled={submitting || loadingProjects}
                  >
                    <option value="">
                      {loadingProjects ? 'Loading projects...' : 'Select a project to import from'}
                    </option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Import Options</label>
                  <div className="checkbox-group">
                    <div className="checkbox-field">
                      <input
                        id="import-tasks"
                        type="checkbox"
                        checked={form.importTasks}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            importTasks: event.target.checked,
                          }))
                        }
                        disabled={submitting}
                      />
                      <label htmlFor="import-tasks">Import Tasks</label>
                    </div>
                    <div className="checkbox-field">
                      <input
                        id="import-notes"
                        type="checkbox"
                        checked={form.importNotes}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            importNotes: event.target.checked,
                          }))
                        }
                        disabled={submitting}
                      />
                      <label htmlFor="import-notes">Import Notes</label>
                    </div>
                    <div className="checkbox-field">
                      <input
                        id="import-tags"
                        type="checkbox"
                        checked={form.importTags}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            importTags: event.target.checked,
                          }))
                        }
                        disabled={submitting}
                      />
                      <label htmlFor="import-tags">Import Tags</label>
                    </div>
                    <div className="checkbox-field">
                      <input
                        id="import-actions"
                        type="checkbox"
                        checked={form.importActions}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            importActions: event.target.checked,
                          }))
                        }
                        disabled={submitting}
                      />
                      <label htmlFor="import-actions">Import Actions</label>
                    </div>
                  </div>
                </div>
              </>
            )}

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
