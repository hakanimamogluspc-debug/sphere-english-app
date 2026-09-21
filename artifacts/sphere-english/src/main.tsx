import { initSentry } from "./lib/sentry";
import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import "./lib/i18n"; // i18n side-effect init — default lang: Türkçe

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) {
  setBaseUrl(apiUrl.replace(/\/+$/, ""));
} else {
  setBaseUrl(null);
}

createRoot(document.getElementById("root")!).render(<App />);

initSentry();
