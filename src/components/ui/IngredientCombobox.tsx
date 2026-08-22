import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { matchesQuery } from "../../lib/ingredientFilter";

export interface ComboboxOption {
  id: number;
  label: string;
  secondary?: string;
}

interface IngredientComboboxProps {
  id?: string;
  value: number | null;
  onChange: (id: number) => void;
  options: ComboboxOption[];
  placeholder: string;
  disabled?: boolean;
  emptyText: string;
  /** Pinned, always-visible first row — unaffected by the search filter. */
  createNewLabel?: string;
  onCreateNew?: () => void;
  "aria-label"?: string;
}

const AUTO_CLEAR_MS = 1000;

/**
 * Searchable/filterable replacement for a plain `<select>` listing every
 * ingredient in the catalogue. Portaled to `document.body` — same reason as
 * `Modal.tsx`: a table's `overflow-x: auto` computes `overflow-y` to `auto`
 * too (CSS overflow spec), so a popup positioned inside a scrolling table
 * cell gets clipped for any row not near the top.
 *
 * Typed search text clears itself after a second of inactivity so a paused
 * search doesn't linger stale — the list reverts to the full catalogue but
 * the dropdown stays open. Cancelled while the user is mid arrow-key
 * navigation (moving the highlight is a clear "still deciding" signal).
 */
export default function IngredientCombobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  emptyText,
  createNewLabel,
  onCreateNew,
  "aria-label": ariaLabel,
}: IngredientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const navigatedRef = useRef(false);
  const listboxId = useId();

  const selected = options.find(o => o.id === value) ?? null;
  const filtered = options.filter(o => matchesQuery(o.label, query));

  // Navigable rows: the pinned "create new" row (if any) first, then the
  // filtered options — highlightedIndex indexes into this combined list.
  const navCount = (onCreateNew ? 1 : 0) + filtered.length;

  const clearTimer = () => {
    if (clearTimerRef.current !== undefined) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = undefined;
    }
  };

  const restartClearTimer = () => {
    clearTimer();
    if (navigatedRef.current) return;
    clearTimerRef.current = setTimeout(() => {
      setQuery("");
      setHighlightedIndex(0);
    }, AUTO_CLEAR_MS);
  };

  const updateCoords = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  const openDropdown = () => {
    if (disabled) return;
    setQuery("");
    setHighlightedIndex(0);
    navigatedRef.current = false;
    updateCoords();
    setOpen(true);
  };

  const closeDropdown = () => {
    setOpen(false);
    clearTimer();
    navigatedRef.current = false;
  };

  const selectOption = (option: ComboboxOption) => {
    onChange(option.id);
    closeDropdown();
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updateCoords();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (listboxRef.current?.contains(target)) return;
      closeDropdown();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => clearTimer, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        navigatedRef.current = true;
        clearTimer();
        setHighlightedIndex(i => Math.min(i + 1, Math.max(navCount - 1, 0)));
        break;
      case "ArrowUp":
        e.preventDefault();
        navigatedRef.current = true;
        clearTimer();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        if (onCreateNew && highlightedIndex === 0) {
          onCreateNew();
          closeDropdown();
        } else {
          const option = filtered[highlightedIndex - (onCreateNew ? 1 : 0)];
          if (option) selectOption(option);
        }
        break;
      }
      case "Escape":
        // Stop the native event here — Modal.tsx listens for Escape on
        // `window`, and without this, closing just the dropdown also
        // closes the whole modal this combobox can live inside.
        e.nativeEvent.stopPropagation();
        closeDropdown();
        break;
      case "Tab":
        closeDropdown();
        break;
    }
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setHighlightedIndex(0);
    navigatedRef.current = false;
    restartClearTimer();
  }

  const listbox = open && coords ? createPortal(
    <div
      ref={listboxRef}
      className="combobox-listbox"
      role="listbox"
      id={listboxId}
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      {onCreateNew && createNewLabel && (
        <div
          className="combobox-option combobox-option-create"
          role="option"
          aria-selected={highlightedIndex === 0}
          onMouseDown={e => e.preventDefault()}
          onClick={() => { onCreateNew(); closeDropdown(); }}
        >
          <span>{createNewLabel}</span>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="combobox-empty">{emptyText}</div>
      ) : (
        filtered.map((option, idx) => {
          const navIdx = idx + (onCreateNew ? 1 : 0);
          return (
            <div
              key={option.id}
              className={"combobox-option" + (navIdx === highlightedIndex ? " highlighted" : "")}
              role="option"
              aria-selected={option.id === value}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(navIdx)}
              onClick={() => selectOption(option)}
            >
              <span>{option.label}</span>
              {option.secondary && <span className="combobox-option-secondary">{option.secondary}</span>}
            </div>
          );
        })
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={wrapperRef}>
      <input
        ref={inputRef}
        id={id}
        className="combobox-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        value={open ? query : (selected?.label ?? "")}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={openDropdown}
        onClick={() => { if (!open) openDropdown(); }}
        onChange={e => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {listbox}
    </div>
  );
}
