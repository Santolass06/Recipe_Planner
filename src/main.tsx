import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import { applyTheme } from "./theme";
import "./styles/theme.css";

const initTheme = async () => {
  try {
    await applyTheme(localStorage.getItem("mise-theme"));
  } catch (e) {
    console.warn("theme init failed", e);
  }
};

initTheme().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );
});
