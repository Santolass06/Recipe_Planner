import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="empty" role="status">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title" style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-1)", margin: "0 0 4px" }}>
        {title}
      </p>
      {body && <p className="empty-desc" style={{ margin: "0 0 16px" }}>{body}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
