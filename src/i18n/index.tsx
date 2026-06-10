import React, { createContext, useContext, type ReactNode } from "react";
import { pt } from "./pt";
import { en } from "./en";
import type { Translations } from "./types";

const translations: Record<string, Translations> = {
  pt,
  en,
};

const I18nContext = createContext<Translations>(pt);

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18nContext.Provider value={pt}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
