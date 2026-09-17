export default function ToastRegion({ notifications, onDismiss }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {notifications.map((notification) => (
        <div key={notification.id} className={`toast toast-${notification.tone}`} role="status">
          <div>
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
          </div>
          <button type="button" className="toast-dismiss" onClick={() => onDismiss(notification.id)} aria-label="Fermer la notification">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
