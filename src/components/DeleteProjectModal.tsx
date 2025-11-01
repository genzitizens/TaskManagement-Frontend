import type { ProjectRes } from '../types';

export interface DeleteProjectModalProps {
  isOpen: boolean;
  project: ProjectRes | null;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteProjectModal({
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

  const handleConfirmClick = () => {
    if (submitting) {
      return;
    }
    void onConfirm();
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
        <div className="modal-content">
          <p>
            Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone.
          </p>
          {error ? <p className="error-message">{error}</p> : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="button-danger" onClick={handleConfirmClick} disabled={submitting}>
            {submitting ? 'Deleting…' : 'Delete project'}
          </button>
        </div>
      </div>
    </div>
  );
}
