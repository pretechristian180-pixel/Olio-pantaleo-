import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { inizializzaTracciamento } from "./lib/tracciamento";
import "./index.css";

inizializzaTracciamento();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
