import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from "react";
import type { Translations } from "./types";
import { languageRegistry, referenceLanguage, type LanguageCode } from "./registry";

type Language = LanguageCode;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: referenceLanguage,
  setLanguage: () => {},
  t: (k) => k,
});

function lookup(dict: Translations | undefined, key: string): string | undefined {
  if (!dict) return undefined;
  const keys = key.split(".");
  let val: any = dict;
  for (const k of keys) {
    if (val === undefined) break;
    val = val[k];
  }
  return typeof val === "string" ? val : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("mise_lang");
    const known = languageRegistry.some((l) => l.code === saved);
    return known ? (saved as Language) : referenceLanguage;
  });

  const [dictionaries, setDictionaries] = useState<Partial<Record<Language, Translations>>>({});
  const loadingRef = useRef<Set<Language>>(new Set());

  const loadLanguage = useCallback((lang: Language) => {
    if (dictionaries[lang] || loadingRef.current.has(lang)) return;
    const entry = languageRegistry.find((l) => l.code === lang);
    if (!entry) return;
    loadingRef.current.add(lang);
    entry.load().then((dict) => {
      setDictionaries((prev) => ({ ...prev, [lang]: dict }));
      loadingRef.current.delete(lang);
    });
  }, [dictionaries]);

  useEffect(() => {
    loadLanguage(language);
    // Also load the reference locale so key-fallback works even before the
    // active language finishes loading or for keys missing in a future
    // partially-translated language.
    loadLanguage(referenceLanguage);
  }, [language, loadLanguage]);

  useEffect(() => {
    localStorage.setItem("mise_lang", language);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let result = lookup(dictionaries[language], key);
      if (result === undefined) result = lookup(dictionaries[referenceLanguage], key);
      if (result === undefined) {
        if (import.meta.env.DEV) {
          console.warn(`[i18n] missing key "${key}" for language "${language}"`);
        }
        return key;
      }
      if (params) {
        for (const [pk, pv] of Object.entries(params)) {
          result = result.replace(`{${pk}}`, String(pv));
        }
      }
      return result;
    },
    [dictionaries, language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
