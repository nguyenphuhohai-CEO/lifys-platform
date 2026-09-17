import React from 'react';

function ToastRegion({ toasts, onDismiss }) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div>
            <strong>{toast.title}</strong>
            {toast.message ? <p>{toast.message}</p> : null}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label={`Fermer la notification ${toast.title}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastRegion;
