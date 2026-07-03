import { useEffect, type ReactNode } from "react";
import { usePageHeaderContext } from "../PageHeaderContext";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  search?: ReactNode;
}

/**
 * Registers title/subtitle/actions with the persistent topbar (rendered by
 * Layout) instead of drawing its own header block — the mise design keeps
 * page chrome (title, search, language/theme toggles) fixed above the
 * scrolling content. `search`, when a page needs its own filter UI beyond the
 * topbar's global search box, still renders inline.
 */
export default function PageHeader({ title, subtitle, actions, search }: PageHeaderProps) {
  const { setHeader } = usePageHeaderContext();

  useEffect(() => {
    setHeader({ title, subtitle, actions });
  }, [title, subtitle, actions, setHeader]);

  if (!search) return null;
  return <div style={{ marginBottom: "var(--space-4)" }}>{search}</div>;
}
