export default function Toast({ toasts, onDismiss }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type || 'info'}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <div>
            <strong>{toast.title}</strong>
            {toast.description ? <p>{toast.description}</p> : null}
          </div>
          <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label={`Fermer la notification ${toast.title}`}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
