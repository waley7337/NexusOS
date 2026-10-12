import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "~/App";
import "@/styles/globals.css";
import "~/styles/portfolio.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
