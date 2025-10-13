import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  submitting = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) {
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="modal-header">
          <h3 id="confirm-dialog-title">{title}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            disabled={submitting}
          >
            ×
          </button>
        </div>
        <div className="modal-content">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
          <button type="button" className="button-danger" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
