import { FormEvent, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { z } from 'zod';
import type { ProjectRes, TagCreateInput, TagRes } from '../types';

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);

const API_START_DATE_FORMAT = 'DD-MM-YYYY';

const parseProjectStartDate = (value: string) => {
  // Try DD-MM-YYYY format first since that's what the backend sends
  const apiParsed = dayjs(value, API_START_DATE_FORMAT, true);
  if (apiParsed.isValid()) {
    return apiParsed;
  }

  // Fallback to ISO parsing
  const isoParsed = dayjs(value);
  if (isoParsed.isValid()) {
    return isoParsed;
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
  startAt: z
    .string()
    .min(1, 'Start date is required')
    .refine((value) => dayjs(value, 'YYYY-MM-DD', true).isValid(), {
      message: 'Please provide a valid start date (YYYY-MM-DD format)',
    }),
  endAt: z
    .string()
    .min(1, 'End date is required')
    .refine((value) => dayjs(value, 'YYYY-MM-DD', true).isValid(), {
      message: 'Please provide a valid end date (YYYY-MM-DD format)',
    }),
  color: z.string().optional(),
}).refine((data) => {
  const startDate = dayjs(data.startAt, 'YYYY-MM-DD', true);
  const endDate = dayjs(data.endAt, 'YYYY-MM-DD', true);
  if (startDate.isValid() && endDate.isValid()) {
    return endDate.isSameOrAfter(startDate);
  }
  return true; // Let individual field validation handle invalid dates
}, {
  message: 'End date must be on or after the start date',
  path: ['endAt'], // Show error on end date field
});

interface FormState {
  projectId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  color: string;
}

const toDateInputValue = (value: string) => {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
};

const createInitialState = (projectId?: string, tag?: TagRes | null): FormState => {
  if (tag) {
    return {
      projectId: tag.projectId,
      title: tag.title,
      description: tag.description ?? '',
      startAt: toDateInputValue(tag.startAt),
      endAt: toDateInputValue(tag.endAt),
      color: tag.color ?? '#10b981', // Default green color for tags
    };
  }

  return {
    projectId: projectId ?? '',
    title: '',
    description: '',
    startAt: '',
    endAt: '',
    color: '#10b981', // Default green color for tags
  };
};

export interface TagModalProps {
  isOpen: boolean;
  projects: ProjectRes[];
  defaultProjectId?: string;
  submitting: boolean;
  mode?: 'create' | 'edit';
  tag?: TagRes | null;
  onSubmit: (input: TagCreateInput) => Promise<void>;
  onClose: () => void;
}

export default function TagModal({
  isOpen,
  projects,
  defaultProjectId,
  submitting,
  mode = 'create',
  tag,
  onSubmit,
  onClose,
}: TagModalProps) {
  const [form, setForm] = useState<FormState>(() => createInitialState(defaultProjectId, tag));
  const [formError, setFormError] = useState<string | null>(null);
  const [dateErrors, setDateErrors] = useState<{startAt?: string | null; endAt?: string | null}>({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm(createInitialState(defaultProjectId, tag));
    setFormError(null);
  }, [defaultProjectId, isOpen, mode, tag]);

  // Date validation helpers
  const validateDate = (dateStr: string, fieldName: 'startAt' | 'endAt') => {
    if (!dateStr) {
      return `${fieldName === 'startAt' ? 'Start' : 'End'} date is required`;
    }
    
    const date = dayjs(dateStr, 'YYYY-MM-DD', true);
    if (!date.isValid()) {
      return `Please provide a valid ${fieldName === 'startAt' ? 'start' : 'end'} date`;
    }
    
    return null;
  };

  const validateDateRange = (startAt: string, endAt: string) => {
    const startDate = dayjs(startAt, 'YYYY-MM-DD', true);
    const endDate = dayjs(endAt, 'YYYY-MM-DD', true);
    
    if (startDate.isValid() && endDate.isValid() && endDate.isBefore(startDate)) {
      return 'End date must be on or after the start date';
    }
    
    return null;
  };

  // Real-time date validation
  const handleDateChange = (field: 'startAt' | 'endAt', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    
    // Validate the specific field
    const fieldError = validateDate(value, field);
    
    // Validate date range if both dates are present
    const otherField = field === 'startAt' ? 'endAt' : 'startAt';
    const otherValue = field === 'startAt' ? form.endAt : form.startAt;
    const rangeError = value && otherValue ? validateDateRange(
      field === 'startAt' ? value : otherValue,
      field === 'endAt' ? value : otherValue
    ) : null;
    
    setDateErrors((prev) => {
      const newErrors = { ...prev };
      newErrors[field] = fieldError;
      
      // Handle range validation
      if (rangeError) {
        newErrors.endAt = rangeError;
      } else if (field === 'endAt' && !fieldError) {
        // Clear range error if end date is now valid and no field error
        newErrors.endAt = fieldError;
      }
      
      return newErrors;
    });
  };

  const submitLabel = useMemo(
    () => {
      if (mode === 'edit') {
        return submitting ? 'Saving…' : 'Save changes';
      }
      return submitting ? 'Creating…' : 'Create tag';
    },
    [mode, submitting],
  );

  const titleLabel = mode === 'edit' ? 'Edit Tag' : 'Add Tag';

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (submitting) {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    // Check for real-time date validation errors
    const hasDateErrors = Object.values(dateErrors).some(error => error);
    if (hasDateErrors) {
      setFormError('Please fix the date validation errors before submitting');
      return;
    }

    const result = tagSchema.safeParse({
      projectId: form.projectId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startAt: form.startAt,
      endAt: form.endAt,
      color: form.color,
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
          <h3 id="tag-modal-title">{titleLabel}</h3>
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
            <div 
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: '#f9fafb',
                color: '#374151',
                fontSize: '14px',
              }}
            >
              {projects.find(p => p.id === form.projectId)?.name || 'No project selected'}
            </div>
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
              onChange={(event) => handleDateChange('startAt', event.target.value)}
              required
              disabled={submitting}
              style={{
                borderColor: dateErrors.startAt ? '#dc2626' : undefined,
              }}
            />
            {dateErrors.startAt && (
              <div style={{ color: '#dc2626', fontSize: '14px', marginTop: '4px' }}>
                {dateErrors.startAt}
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="tag-end-modal">End</label>
            <input
              id="tag-end-modal"
              name="endAt"
              type="date"
              value={form.endAt}
              onChange={(event) => handleDateChange('endAt', event.target.value)}
              required
              disabled={submitting}
              style={{
                borderColor: dateErrors.endAt ? '#dc2626' : undefined,
              }}
            />
            {dateErrors.endAt && (
              <div style={{ color: '#dc2626', fontSize: '14px', marginTop: '4px' }}>
                {dateErrors.endAt}
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="tag-color-modal">Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="tag-color-modal"
                name="color"
                type="color"
                value={form.color}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                disabled={submitting}
                style={{ width: '40px', height: '32px' }}
              />
              <div 
                style={{
                  width: '60px',
                  height: '32px',
                  backgroundColor: form.color,
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              />
            </div>
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
