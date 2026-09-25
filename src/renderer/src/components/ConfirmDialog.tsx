interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Leave',
  cancelLabel = 'Stay',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card card" onClick={e => e.stopPropagation()}>
        <div className="card-header">
          <h2 className="card-title">{title}</h2>
        </div>
        <div className="card-body">
          <p className="modal-message">{message}</p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button className="btn btn-danger" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
