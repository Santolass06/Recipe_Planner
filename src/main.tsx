import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import "./styles/theme.css";

const initTheme = () => {
  try {
    const saved = localStorage.getItem("mise-theme");
    if (saved === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else if (saved === "system") {
      if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        document.documentElement.setAttribute("data-theme", "light");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch (e) {}
};
initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
