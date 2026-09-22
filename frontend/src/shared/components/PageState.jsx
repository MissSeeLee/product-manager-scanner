function FeedbackMessage({ type = "error", children }) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={`message message-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

function LoadingState({ message = "กำลังโหลดข้อมูล..." }) {
  return (
    <div className="card page-state" role="status">
      <div className="loading-spinner" />

      <span>{message}</span>
    </div>
  );
}

function EmptyState({ title = "ยังไม่มีข้อมูล", description, children }) {
  return (
    <div className="empty-state-block">
      <strong>{title}</strong>

      {description && <span>{description}</span>}

      {children && <div className="form-actions">{children}</div>}
    </div>
  );
}

export { EmptyState, FeedbackMessage, LoadingState };
