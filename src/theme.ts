import { invoke } from "@tauri-apps/api/core";

// WebKitGTK's `prefers-color-scheme` media feature doesn't follow modern
// GNOME's dark-mode setting (org.gnome.desktop.interface color-scheme), so
// it always reports "light" there regardless of the desktop's actual
// preference. Ask the backend (which shells out to `gsettings`) instead,
// falling back to the media query if that's unavailable (e.g. non-Linux).
export async function systemPrefersDark(): Promise<boolean> {
  try {
    const theme = await invoke<string>("get_system_theme");
    return theme === "dark";
  } catch {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
}

export async function applyTheme(saved: string | null) {
  if (saved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else if (saved === "system") {
    document.documentElement.setAttribute("data-theme", (await systemPrefersDark()) ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

export function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
