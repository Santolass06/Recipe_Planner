import { useEffect, useRef } from "react";
import { useI18n } from "../../i18n";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  shortcut?: string;
}

export default function SearchBar({ value, onChange, placeholder, shortcut = "Ctrl+K" }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? `${t("common.search")}…`;

  useEffect(() => {
    const handleFocus = () => inputRef.current?.focus();
    window.addEventListener("mise:focus-search", handleFocus);
    return () => window.removeEventListener("mise:focus-search", handleFocus);
  }, []);

  return (
    <div className="search-bar" role="search" aria-label={resolvedPlaceholder}>
      <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ color: "var(--text-3)" }}>
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        ref={inputRef}
        placeholder={resolvedPlaceholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={t("common.search")}
      />
      {shortcut && <kbd className="kbd">{shortcut}</kbd>}
    </div>
  );
}
