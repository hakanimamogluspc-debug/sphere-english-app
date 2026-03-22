import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8080";
setBaseUrl(apiUrl.replace(/\/+$/, ""));

createRoot(document.getElementById("root")!).render(<App />);
