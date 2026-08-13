import { useEffect, useState } from "react";
import { invoke } from "./devInvoke";
import type { Edition } from "../../crates/core/bindings/Edition";

/**
 * Pro-only navigation paths (PRD-02). Family edition must not surface these in
 * the sidebar, the router, or the reports tabs. Kept here so the rule lives in
 * one place instead of being duplicated across screens.
 */
export const PRO_ONLY_PATHS: readonly string[] = [
  "/fornecedores",
  "/custos",
  "/eventos",
];

export const isProEdition = (edition: Edition): boolean => edition === "pro";

// ---------------------------------------------------------------------------
// Lightweight module-level edition cache.
//
// There is no existing global state for the edition, so a tiny observable
// store is used instead of threading a context through main.tsx. Every call
// to `edition_get` caches the result and fans the new value out to any
// subscriber (Sidebar, ReportsPage, …). SettingsPage calls `setEditionCache`
// after a successful `edition_set` so the rest of the UI updates instantly
// without a round-trip the caller already knows the answer to.
// ---------------------------------------------------------------------------

let cachedEdition: Edition | null = null;
const subscribers = new Set<() => void>();

export async function loadEdition(): Promise<Edition> {
  try {
    cachedEdition = await invoke<Edition>("edition_get");
  } catch {
    cachedEdition = "family";
  }
  subscribers.forEach((l) => l());
  return cachedEdition;
}

export function setEditionCache(next: Edition): void {
  cachedEdition = next;
  subscribers.forEach((l) => l());
}

export function useEdition(): Edition {
  const [edition, setEdition] = useState<Edition>(cachedEdition ?? "family");
  useEffect(() => {
    void loadEdition();
    const sub = () => setEdition(cachedEdition ?? "family");
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);
  return edition;
}
