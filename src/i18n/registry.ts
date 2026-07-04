import type { Translations } from "./types";

export type LanguageCode = "pt" | "en";

export interface LanguageEntry {
  code: LanguageCode;
  label: string;
  load: () => Promise<Translations>;
}

export const referenceLanguage: LanguageCode = "pt";

export const languageRegistry: LanguageEntry[] = [
  {
    code: "pt",
    label: "Português",
    load: async () => (await import("./locales/pt")).pt,
  },
  {
    code: "en",
    label: "English",
    load: async () => (await import("./locales/en")).en,
  },
];
