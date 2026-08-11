const raw = import.meta.env.VITE_API_URL as string | undefined;
export const API = raw ? raw.replace(/\/+$/, "") : "/api";
