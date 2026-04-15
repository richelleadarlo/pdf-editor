import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "@/styles.css";

(function bootstrapTheme() {
  try {
    const storedTheme = window.localStorage.getItem("pdf-editor-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : prefersDark
          ? "dark"
          : "light";

    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  } catch {
    // Ignore storage/media access errors and continue with default theme.
  }
})();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root container not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
