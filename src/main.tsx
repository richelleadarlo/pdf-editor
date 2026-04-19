import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "@/styles.css";

(function bootstrapTheme() {
  try {
    document.documentElement.style.colorScheme = "light";
  } catch {
    // Ignore access errors and continue.
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
