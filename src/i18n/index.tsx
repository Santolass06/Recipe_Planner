import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react";
import { pt } from "./pt";
import { en } from "./en";
import type { Translations } from "./types";

type Language = "pt" | "en";

const dictionaries: Record<Language, Translations> = {
  pt,
  en,
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: "pt",
  setLanguage: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("mise_lang");
    if (saved === "pt" || saved === "en") return saved as Language;
    return "pt";
  });

  useEffect(() => {
    localStorage.setItem("mise_lang", language);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split(".");
      let val: any = dictionaries[language];
      for (const k of keys) {
        if (val === undefined) break;
        val = val[k];
      }

      if (typeof val !== "string") {
        return key;
      }

      let result = val;
      if (params) {
        for (const [pk, pv] of Object.entries(params)) {
          result = result.replace(`{${pk}}`, String(pv));
        }
      }
      return result;
    },
    [language]
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
