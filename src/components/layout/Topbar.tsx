import { Search, Bell, Settings } from "lucide-react";

interface TopbarProps {
  placeholder?: string;
  search?: string;
  onSearch?: (v: string) => void;
  right?: React.ReactNode;
}

export default function Topbar({
  placeholder = "Pesquisar ingredientes, receitas…",
  search,
  onSearch,
  right,
}: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-center">
        <div className="search-wrap">
          <span className="search-icon">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={search ?? ""}
            onChange={(e) => onSearch?.(e.target.value)}
          />
          <span className="search-kbd">⌘K</span>
        </div>

        <div style={{ flex: 1 }} />
        {right && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {right}
          </div>
        )}
      </div>

      <div className="topbar-divider" />
      <button className="icon-btn" title="Notificações">
        <Bell size={17} />
        <span className="notif-dot" />
      </button>
      <button className="icon-btn" title="Definições">
        <Settings size={17} />
      </button>
    </div>
  );
}
