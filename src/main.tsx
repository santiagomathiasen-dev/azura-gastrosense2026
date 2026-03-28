window.onerror = function (message, source, lineno, colno, error) {
  console.error("GLOBAL ERROR:", message, "at", source, lineno, colno, error);
  const root = document.getElementById("root");
  if (root && (!root.innerHTML || root.innerHTML.includes("Carregando"))) {
    const escapeHtml = (s: unknown) => String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    root.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>Erro Crítico no Sistema</h2>
      <pre>${escapeHtml(message)}</pre>
      <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" style="padding: 10px; background: #1b5e3f; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Limpar Dados e Recarregar
      </button>
    </div>`;
  }
};

console.log("Main.tsx: Script evaluation started at the top");
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
console.log("Main.tsx: root element found:", !!rootElement);

try {
  if (rootElement) {
    console.log("Main.tsx: react-dom createRoot starting");
    const root = createRoot(rootElement);
    console.log("Main.tsx: render starting");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Main.tsx: Render called successfully");
  } else {
    console.error("Main.tsx: Root element not found!");
  }
} catch (e) {
  console.error("Main.tsx: CRASH DURING RENDER:", e);
}


