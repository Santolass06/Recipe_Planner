import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import type { Ingrediente } from "../../types";

interface Props {
  ingredientes: Ingrediente[];
  value: number;               // 0 = unselected
  onChange: (id: number) => void;
}

export default function SelectIngrediente({ ingredientes, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = ingredientes.find((i) => i.id === value) ?? null;

  const filtered = ingredientes.filter((i) =>
    i.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
        setCursor(-1);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 10);
      setCursor(-1);
    }
  }, [open]);

  // Scroll cursor into view
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const item = listRef.current.children[cursor] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor]);

  const select = useCallback(
    (id: number) => {
      onChange(id);
      setOpen(false);
      setSearch("");
      setCursor(-1);
    },
    [onChange]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
      setCursor(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (cursor >= 0 && filtered[cursor]) {
        select(filtered[cursor].id);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        type="button"
        className="form-select"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          background: "var(--card)",
        }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: selected ? "var(--text)" : "var(--text-light)",
            fontSize: 13.5,
          }}
        >
          {selected ? `${selected.nome} (${selected.unidade})` : "Seleccionar ingrediente…"}
        </span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--card)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Filtrar…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCursor(-1); }}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                width: "100%",
                fontSize: 13,
                color: "var(--text)",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          {/* Options */}
          <ul
            ref={listRef}
            role="listbox"
            style={{
              listStyle: "none",
              margin: 0,
              padding: "4px 0",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {filtered.length === 0 ? (
              <li
                style={{
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                Nenhum ingrediente encontrado
              </li>
            ) : (
              filtered.map((ing, idx) => {
                const isSelected = ing.id === value;
                const isCursor = idx === cursor;
                return (
                  <li
                    key={ing.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => { e.preventDefault(); select(ing.id); }}
                    onMouseEnter={() => setCursor(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 14px",
                      cursor: "pointer",
                      fontSize: 13.5,
                      background: isCursor
                        ? "var(--primary-soft)"
                        : isSelected
                        ? "var(--primary-tint)"
                        : "transparent",
                      color: isCursor ? "var(--primary-hover)" : "var(--text)",
                      transition: "background 0.08s",
                    }}
                  >
                    <span>
                      {ing.nome}
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {ing.unidade}
                      </span>
                    </span>
                    {isSelected && (
                      <Check size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
