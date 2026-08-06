import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

// Defensive guard against a malformed index.html; the real template always
// ships #root, so this never fires through any real browser navigation and
// isn't something an e2e test can reach without serving broken HTML.
/* istanbul ignore if */
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
