import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  search?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions, search }: PageHeaderProps) {
  return (
    <div className="content-header">
      <div>
        <h1 className="content-title">{title}</h1>
        {subtitle && <p className="content-sub mono">{subtitle}</p>}
      </div>
      <div className="spacer" />
      {search && <div>{search}</div>}
      {actions && <div>{actions}</div>}
    </div>
  );
}
